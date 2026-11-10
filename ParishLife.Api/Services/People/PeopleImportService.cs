// Purpose: stages a CSV people import privately, validates the whole file before anything is written (names, unambiguous dates, repeated
// source identifiers, likely duplicates), and commits it in batches only after review, all-or-valid-rows-only by explicit choice.
// Main functions: StageAsync, CommitAsync and GetAsync.

using System.Globalization;
using System.Text;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Services.People;

public class PeopleImportService(IRecordTransactions records, IParishAccess access, ICurrentActor actor, MfaAccountAccess proof, TimeProvider clock)
{
    private static readonly string[] Header = ["GivenName", "FamilyName", "BirthDate", "Contact", "SourceId"];
    private const int MaximumRows = 1000;
    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    private static DomainException State(string message) => new("invalid_import_state", message, FailureKind.Conflict);
    private static string SourceKey(string source, string id) => "personImportSource:" + PeopleDirectoryService.Normalize(source).Replace(':', '_') + ":" + id;

    private async Task<Versioned<Parish>> ImporterAsync(string parish, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        await access.RequireAsync(parish, Permissions.PeopleWrite, ct);
        var root = await access.RequireAsync(parish, Permissions.ImportsManage, ct);
        await access.RequireModuleAsync(parish, "office", ct);
        return root;
    }

    public async Task<PeopleImportDto> StageAsync(string parish, StagePeopleImportDto request, CancellationToken ct)
    {
        var root = await ImporterAsync(parish, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "people-import:v1:" + parish);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } prior)
            return await GetAsync(parish, prior.Id, ct);
        var lines = request.Csv.Replace("\r\n", "\n").Split('\n').Where(l => l.Length > 0).ToList();
        if (lines.Count < 2 || !Split(lines[0]).SequenceEqual(Header))
            throw new DomainException("invalid_input", "Use the template header: " + string.Join(',', Header) + ".");
        if (lines.Count - 1 > MaximumRows)
            throw new DomainException("invalid_input", "Split the file into parts of up to " + MaximumRows + " rows.");
        var source = Guard.Text(request.SourceName, "Source name", 200);
        var current = (await records.CollectAsync<Person>(Scope(parish), "person", ct, 20000)).Select(r => r.Value).Where(p => !p.Archived)
            .Select(p => Identity(p.GivenName, p.FamilyName, p.BirthDate)).ToHashSet(StringComparer.Ordinal);
        var rows = new List<PeopleImportRow>();
        var seen = new HashSet<string>(StringComparer.Ordinal);
        for (var i = 1; i < lines.Count; i++)
        {
            var cells = Split(lines[i]);
            var row = new PeopleImportRow { Line = i + 1, Original = lines[i] };
            var problems = new List<string>();
            if (cells.Length != Header.Length)
                problems.Add("Expected " + Header.Length + " columns.");
            else
            {
                row.GivenName = cells[0].Trim();
                row.FamilyName = cells[1].Trim();
                row.Contact = string.IsNullOrWhiteSpace(cells[3]) ? null : cells[3].Trim();
                row.SourceId = cells[4].Trim();
                if (row.GivenName.Length is 0 or > 100 || row.FamilyName.Length is 0 or > 100) problems.Add("Given and family names are required (up to 100 characters).");
                if (row.Contact?.Length > 320) problems.Add("Contact is too long.");
                if (row.SourceId.Length is 0 or > 100) problems.Add("Each row needs the source system's identifier.");
                else if (!seen.Add(row.SourceId)) problems.Add("The source identifier repeats in this file.");
                if (!string.IsNullOrWhiteSpace(cells[2]))
                {
                    if (ParseDate(cells[2].Trim(), request.DateOrder, out var date) is { } dateProblem) problems.Add(dateProblem);
                    else row.BirthDate = date;
                }
            }
            row.Problems = [.. problems];
            row.Outcome = problems.Count > 0 ? "Error"
                : await records.ReadAsync<CommandResult>(Scope(parish), SourceKey(source, row.SourceId), ct) is not null ? "Duplicate"
                : current.Contains(Identity(row.GivenName, row.FamilyName, row.BirthDate)) ? "PossibleDuplicate" : "Valid";
            rows.Add(row);
        }
        var item = new PeopleImport
        {
            Id = op.Id, ParishId = parish, SourceName = source, SourceOwner = Guard.Text(request.SourceOwner, "Source owner", 200), SourceDate = request.SourceDate,
            DateOrder = request.DateOrder, Rows = rows, StagedBy = actor.AccountId, StagedAt = op.At
        };
        await records.CommitAsync(Scope(parish), op, "people.import_stage", item.Id,
            [RecordChange.Replace("parish", "parish", root.Value, root.Version), RecordChange.Create("peopleImport:" + item.Id, "peopleImport", item)],
            new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return await GetAsync(parish, item.Id, ct);
    }

    // Default is all-or-nothing; ValidRowsOnly imports exactly the Valid rows and leaves the rest listed for follow-up.
    public async Task<PeopleImportDto> CommitAsync(string parish, string id, CommitPeopleImportDto request, CancellationToken ct)
    {
        await ImporterAsync(parish, ct);
        var row = await ReadAsync(parish, id, ct);
        if (row.Version != Versions.Require(request.Version) && row.Value.Status != "Committing")
            throw new DomainException("write_conflict", "The import changed; reload it before committing.", FailureKind.Conflict);
        var item = row.Value;
        if (item.Status == "Committed")
            return await GetAsync(parish, id, ct);
        if (!request.ValidRowsOnly && item.Rows.Any(r => r.Outcome is not ("Valid" or "Imported")))
            throw State("Some rows have problems or duplicates; fix the file, or choose to import valid rows only.");
        var version = row.Version;
        // Batches stay within one transaction each; a retry skips rows already imported.
        foreach (var batch in item.Rows.Where(r => r.Outcome == "Valid").Chunk(45))
        {
            var root = await access.RequireAsync(parish, Permissions.ImportsManage, ct);
            var op = Operation.Create(Guid.NewGuid(), actor.AccountId, new { id, first = batch[0].Line }, clock, "people-import-batch:v1:" + id, actor.ActingAppointmentId);
            var changes = new List<RecordChange> { RecordChange.Replace("parish", "parish", root.Value, root.Version) };
            foreach (var r in batch)
            {
                var person = new Person
                {
                    Id = Guid.NewGuid().ToString(), ParishId = parish, GivenName = r.GivenName, FamilyName = r.FamilyName, BirthDate = r.BirthDate,
                    Contact = r.Contact, CreatedBy = actor.AccountId, CreatedAt = op.At
                };
                changes.Add(RecordChange.Create("person:" + person.Id, "person", person));
                changes.Add(RecordChange.Create(SourceKey(item.SourceName, r.SourceId), "personImportSource", new CommandResult { Id = person.Id, Status = "Imported" }));
                r.Outcome = "Imported";
                r.PersonId = person.Id;
            }
            item.Status = "Committing";
            changes.Add(RecordChange.Replace("peopleImport:" + id, "peopleImport", item, version));
            await records.CommitAsync(Scope(parish), op, "people.import_batch", id, changes, new CommandResult { Id = id, Status = item.Status }, ct);
            version = (await ReadAsync(parish, id, ct)).Version;
        }
        item.Status = "Committed";
        item.CommittedBy = actor.AccountId;
        item.CommittedAt = clock.GetUtcNow();
        await records.CommitAsync(Scope(parish), Operation.Create(Guid.NewGuid(), actor.AccountId, new { id }, clock, "people-import-commit:v1:" + id, actor.ActingAppointmentId),
            "people.import_commit", id, [RecordChange.Replace("peopleImport:" + id, "peopleImport", item, version)], new CommandResult { Id = id, Status = item.Status }, ct);
        return await GetAsync(parish, id, ct);
    }

    public async Task<PeopleImportDto> GetAsync(string parish, string id, CancellationToken ct)
    {
        await ImporterAsync(parish, ct);
        var row = await ReadAsync(parish, id, ct);
        var x = row.Value;
        return new PeopleImportDto
        {
            Id = x.Id, Version = row.Version, SourceName = x.SourceName, SourceOwner = x.SourceOwner, SourceDate = x.SourceDate, Status = x.Status,
            Counts = x.Rows.GroupBy(r => r.Outcome).ToDictionary(g => g.Key, g => g.Count()), StagedBy = x.StagedBy, StagedAt = x.StagedAt,
            CommittedBy = x.CommittedBy, CommittedAt = x.CommittedAt,
            Rows = x.Rows.Select(r => new PeopleImportRowDto
            {
                Line = r.Line, Original = r.Original, GivenName = r.GivenName, FamilyName = r.FamilyName, BirthDate = r.BirthDate, Contact = r.Contact,
                SourceId = r.SourceId, Problems = r.Problems, Outcome = r.Outcome, PersonId = r.PersonId
            }).ToArray()
        };
    }

    private async Task<Versioned<PeopleImport>> ReadAsync(string parish, string id, CancellationToken ct)
        => await records.ReadAsync<PeopleImport>(Scope(parish), "peopleImport:" + id, ct) is { } row && row.Value.ParishId == parish ? row
            : throw new DomainException("resource_not_found", "The requested import is unavailable.", FailureKind.NotFound);

    private static string Identity(string given, string family, DateOnly? birth)
        => PeopleDirectoryService.Normalize(given) + "|" + PeopleDirectoryService.Normalize(family) + "|" + birth?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    // ISO dates are always accepted; d/m/y dates need the stated order whenever the day could also be a month. Nothing is guessed.
    private static string? ParseDate(string value, string? order, out DateOnly date)
    {
        date = default;
        if (DateOnly.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out date))
            return null;
        var parts = value.Split('/', '.', '-');
        if (parts.Length == 1 && parts[0].Length == 4)
            return "Year-only birth dates cannot be stored on the person record yet; leave it blank and keep the year in the source.";
        if (parts.Length != 3 || !parts.All(p => int.TryParse(p, NumberStyles.None, CultureInfo.InvariantCulture, out _)) || parts[2].Length != 4)
            return "Unreadable birth date '" + value + "'.";
        var (first, second) = (int.Parse(parts[0], CultureInfo.InvariantCulture), int.Parse(parts[1], CultureInfo.InvariantCulture));
        if (order is null && first <= 12 && second <= 12 && first != second)
            return "Birth date '" + value + "' could be day/month or month/day; choose the file's date order.";
        var (day, month) = order == "MDY" || order is null && first <= 12 && second > 12 ? (second, first) : (first, second);
        try { date = new DateOnly(int.Parse(parts[2], CultureInfo.InvariantCulture), month, day); return null; }
        catch (ArgumentOutOfRangeException) { return "Impossible birth date '" + value + "'."; }
    }

    // RFC 4180 fields: commas inside quotes and doubled quotes.
    internal static string[] Split(string line)
    {
        var cells = new List<string>();
        var cell = new StringBuilder();
        var quoted = false;
        for (var i = 0; i < line.Length; i++)
        {
            var c = line[i];
            if (quoted && c == '"' && i + 1 < line.Length && line[i + 1] == '"') { cell.Append('"'); i++; }
            else if (c == '"') quoted = !quoted;
            else if (c == ',' && !quoted) { cells.Add(cell.ToString()); cell.Clear(); }
            else cell.Append(c);
        }
        cells.Add(cell.ToString());
        return [.. cells];
    }
}
