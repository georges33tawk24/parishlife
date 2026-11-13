// Purpose: office people search with case- and mark-insensitive matching over Latin and Arabic names (official spellings are never rewritten), and audited CSV
// exports with an explicit purpose and a preview of count, columns and exclusions.
// Main functions: SearchAsync, PreviewExportAsync and ExportAsync.

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

public class PeopleDirectoryService(IRecordTransactions records, IParishAccess access, ICurrentActor actor, MfaAccountAccess proof, TimeProvider clock)
{
    private static readonly string[] Allowed = ["GivenName", "FamilyName", "GivenNameAr", "FamilyNameAr", "BirthDate", "Contact", "Rite", "RegisterStatus", "Archived"];
    private static readonly string[] AlwaysExcluded = ["account links", "credentials and tokens", "pastoral notes and concerns", "sacramental register entries", "household and guardian details"];
    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };

    public async Task<IReadOnlyList<PersonSearchResultDto>> SearchAsync(string parish, string query, bool includeArchived, int size, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        await access.RequireAsync(parish, Permissions.PeopleRead, ct);
        await access.RequireModuleAsync(parish, "office", ct);
        var terms = Normalize(Guard.Text(query, "Search", 200)).Split(' ', StringSplitOptions.RemoveEmptyEntries);
        return (await PeopleAsync(parish, includeArchived, ct))
            .Where(p => terms.All(t => Normalize(p.GivenName + " " + p.FamilyName + " " + p.GivenNameAr + " " + p.FamilyNameAr + " " + p.Contact).Contains(t, StringComparison.Ordinal)))
            .OrderBy(p => p.FamilyName, StringComparer.CurrentCultureIgnoreCase).ThenBy(p => p.GivenName, StringComparer.CurrentCultureIgnoreCase)
            .Take(Math.Clamp(size, 1, 100))
            .Select(p => new PersonSearchResultDto
            {
                Id = p.Id, GivenName = p.GivenName, FamilyName = p.FamilyName, GivenNameAr = p.GivenNameAr, FamilyNameAr = p.FamilyNameAr, BirthDate = p.BirthDate,
                Archived = p.Archived
            }).ToArray();
    }

    public async Task<PeopleExportPreviewDto> PreviewExportAsync(string parish, string[] columns, bool includeArchived, CancellationToken ct)
    {
        await ExporterAsync(parish, ct);
        return new PeopleExportPreviewDto
        {
            Count = (await PeopleAsync(parish, includeArchived, ct)).Count, Columns = Columns(columns), IncludeArchived = includeArchived, Excluded = AlwaysExcluded
        };
    }

    public async Task<string> ExportAsync(string parish, PeopleExportDto request, CancellationToken ct)
    {
        var root = await ExporterAsync(parish, ct);
        var columns = Columns(request.Columns);
        var people = await PeopleAsync(parish, request.IncludeArchived, ct);
        // Every generation is logged with exporter, purpose, scope and count; the file itself is not stored.
        var op = Operation.Create(Guid.NewGuid(), actor.AccountId, new { request.OperationId, columns, request.IncludeArchived }, clock, "people-export:v1:" + parish, actor.ActingAppointmentId);
        var log = new ExportLog
        {
            Id = op.Id, ParishId = parish, Kind = "people", Purpose = Guard.Text(request.Purpose, "Purpose", 500), Columns = columns,
            IncludeArchived = request.IncludeArchived, Count = people.Count, By = actor.AccountId, At = op.At
        };
        await records.CommitAsync(Scope(parish), op, "people.export", op.Id,
            [RecordChange.Replace("parish", "parish", root.Value, root.Version), RecordChange.Create("exportLog:" + op.Id, "exportLog", log)],
            new CommandResult { Id = op.Id, Status = "Generated" }, ct);
        var csv = new StringBuilder(string.Join(',', columns)).Append("\r\n");
        foreach (var p in people)
            csv.Append(string.Join(',', columns.Select(c => Cell(c switch
            {
                "GivenName" => p.GivenName,
                "FamilyName" => p.FamilyName,
                "GivenNameAr" => p.GivenNameAr,
                "FamilyNameAr" => p.FamilyNameAr,
                "Rite" => p.Rite,
                "RegisterStatus" => p.RegisterStatus,
                "BirthDate" => p.BirthDate?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                "Contact" => p.Contact,
                _ => p.Archived ? "yes" : "no"
            })))).Append("\r\n");
        return csv.ToString();
    }

    private async Task<Versioned<Parish>> ExporterAsync(string parish, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        await access.RequireAsync(parish, Permissions.PeopleRead, ct);
        var root = await access.RequireAsync(parish, Permissions.ExportsManage, ct);
        await access.RequireModuleAsync(parish, "office", ct);
        return root;
    }

    // ponytail: scans the parish's people (cap 20000); add a normalized-name index when a parish outgrows it.
    private async Task<List<Person>> PeopleAsync(string parish, bool includeArchived, CancellationToken ct)
        => (await records.CollectAsync<Person>(Scope(parish), "person", ct, 20000)).Select(r => r.Value).Where(p => includeArchived || !p.Archived).ToList();

    private static string[] Columns(string[]? columns)
    {
        if (columns is null || columns.Length == 0 || columns.Any(c => !Allowed.Contains(c)) || columns.Distinct().Count() != columns.Length)
            throw new DomainException("invalid_input", "Choose columns from " + string.Join(", ", Allowed) + ".");
        return columns;
    }

    // Spreadsheet formulas are neutralized and quoting follows RFC 4180.
    private static string Cell(string? value)
    {
        value ??= "";
        if (value.Length > 0 && value[0] is '=' or '+' or '-' or '@' or '\t' or '\r')
            value = "'" + value;
        return value.IndexOfAny([',', '"', '\r', '\n']) >= 0 ? "\"" + value.Replace("\"", "\"\"") + "\"" : value;
    }

    internal static string Normalize(string value)
    {
        var text = new StringBuilder();
        foreach (var c in value.Normalize(NormalizationForm.FormD))
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                text.Append(char.ToLowerInvariant(c));
        return text.ToString().Normalize(NormalizationForm.FormC);
    }
}
