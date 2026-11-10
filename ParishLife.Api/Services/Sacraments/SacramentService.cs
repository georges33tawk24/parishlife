// Purpose: runs sacramental cases from priest acceptance through preparation, scheduling and actual celebration to official registration,
// with priest-approved numbering, secretary-recorded prior priest instructions and amendment-only corrections of registered entries.
// Main functions: CreateAsync, ActAsync, SetPolicyAsync, ProposeCorrectionAsync, DecideCorrectionAsync, GetAsync, RegisterAsync (search)
// PendingCorrectionsAsync, AnniversariesAsync and MyAnniversariesAsync; helpers check priest authority, numbering, duplicates and project current (amended) facts.

using ParishLife.Api.DTOs.Sacraments;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;
using ParishLife.Api.Services.Ministries;

namespace ParishLife.Api.Services.Sacraments;

public class SacramentService(IRecordTransactions records, IParishAccess access, IParishRepository parishes, IClergyAuthority clergy,
    IAccountDirectory accounts, MinistryAccess own, ICurrentActor actor, MfaAccountAccess proof, TimeProvider clock)
{
    private static readonly string[] Celebrated = ["Baptism", "FirstCommunion", "Confirmation", "Marriage"];
    private static readonly string[] OnceOnly = ["Baptism", "FirstCommunion", "Confirmation"];
    private static readonly string[] CoreFields = ["place", "celebrantName", "witnesses", "bookReference", "celebratedAt"];
    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    private static string Key(string id) => "sacrament:" + id;
    private static RecordCondition Equal(string path, string value) => new() { Path = path, Comparison = "eq", Value = value };
    private static DomainException Missing() => new("resource_not_found", "The requested sacramental record is unavailable.", FailureKind.NotFound);
    private static DomainException State(string message) => new("invalid_sacrament_state", message, FailureKind.Conflict);
    private static RecordChange Fence(Versioned<Parish> root) => RecordChange.Replace("parish", "parish", root.Value, root.Version);

    private async Task<Versioned<Parish>> OfficeAsync(string parish, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        var root = await access.RequireAsync(parish, Permissions.SacramentsRecord, ct);
        await access.RequireModuleAsync(parish, "sacraments", ct);
        return root;
    }

    private async Task<Versioned<Parish>> PriestAsync(string parish, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        await clergy.RequireAsync(parish, actor.AccountId, "Priest", ct);
        await access.RequireModuleAsync(parish, "sacraments", ct);
        return await parishes.GetAsync(parish, ct) ?? throw Missing();
    }

    private async Task<bool> IsPriestAsync(string parish, string account, CancellationToken ct)
    {
        try { await clergy.RequireAsync(parish, account, "Priest", ct); return true; }
        catch (DomainException) { return false; }
    }

    public async Task<SacramentRecordDto> CreateAsync(string parish, CreateSacramentDto request, CancellationToken ct)
    {
        var root = await OfficeAsync(parish, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "sacrament:v1:" + parish);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } prior)
            return Project((await ReadAsync(parish, prior.Id, ct)).Value);
        var person = Guard.Id(request.SubjectPersonId);
        if ((await records.ReadAsync<Person>(Scope(parish), "person:" + person, ct))?.Value is not { Archived: false } subject || subject.ParishId != parish)
            throw Missing();
        if (OnceOnly.Contains(request.Sacrament) && (await CasesAsync(parish, person, ct)).Any(r => r.Kind == request.Sacrament && r.Status is not ("Declined" or "Cancelled")))
            throw State("This person already has an active or registered " + request.Sacrament + " case; review it instead of creating a duplicate.");
        var item = new SacramentRecord
        {
            Id = op.Id, ParishId = parish, Kind = request.Sacrament, PersonId = person, RequestId = request.RequestId is { } r ? Guard.Id(r) : null,
            Facts = Facts(request.Facts), TentativeDate = string.IsNullOrWhiteSpace(request.TentativeDate) ? null : Guard.Text(request.TentativeDate, "Tentative date", 200),
            CreatedBy = actor.AccountId, CreatedAt = op.At
        };
        Step(item, "open", "", item.Status, op.At, null);
        await records.CommitAsync(Scope(parish), op, "sacrament.open", item.Id, [Fence(root), RecordChange.Create(Key(item.Id), "sacramentRecord", item)],
            new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return Project(item);
    }

    public async Task<SacramentRecordDto> ActAsync(string parish, string id, SacramentActionDto request, CancellationToken ct)
    {
        var decision = request.Action is "accept" or "decline" or "cancel" or "reschedule";
        Versioned<Parish> root;
        SacramentStep? instruction = null;
        if (request.Action is "return-entry" or "register")
            root = await PriestAsync(parish, ct);
        else if (decision && await IsPriestAsync(parish, actor.AccountId, ct))
            root = await PriestAsync(parish, ct);
        else
        {
            root = await OfficeAsync(parish, ct);
            if (decision)
            {
                // A secretary may record a genuine prior instruction of a current priest; it is effective when recorded and keeps both identities.
                var priest = Guard.Id(request.InstructingPriestAccountId ?? throw State("This decision needs a priest, or a recorded instruction from a current priest."));
                if (!await IsPriestAsync(parish, priest, ct) || request.InstructionGivenAt is not { } given || Guard.Utc(given) > clock.GetUtcNow())
                    throw State("Record the instructing current priest and when the instruction was actually given.");
                instruction = new SacramentStep { InstructingPriestAccountId = priest, InstructionBasis = Guard.Text(request.InstructionBasis, "Instruction basis", 1000), InstructionGivenAt = given };
            }
        }
        var op = actor.CreateOperation(request.OperationId, request, clock, "sacrament-action:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return Project((await ReadAsync(parish, id, ct)).Value);
        var item = (await ReadAsync(parish, id, ct)).Value;
        var from = item.Status;
        var changes = new List<RecordChange> { Fence(root) };
        string? note = null;
        switch (request.Action)
        {
            case "accept" when item.Status == "Received":
                // Acceptance starts preparation; it verifies no evidence, reserves no date and proves no celebration.
                item.Status = "Preparation";
                break;
            case "schedule" when item.Status == "Preparation":
                if (request.ScheduledAt is not { } at || Guard.Utc(at) <= op.At)
                    throw new DomainException("invalid_input", "A confirmed date must be a future UTC instant.");
                await CelebrantAsync(item, request, ct);
                item.ScheduledAt = at;
                item.Status = "Scheduled";
                break;
            case "reschedule" when item.Status == "Scheduled":
                note = Guard.Text(request.Reason, "Reason", 2000);
                item.ScheduledAt = null;
                item.Status = "Preparation";
                break;
            case "decline" when item.Status is "Received" or "Preparation":
            case "cancel" when item.Status is "Preparation" or "Scheduled":
                // Only pre-celebration cases end this way; celebrated and registered history is corrected, never erased.
                note = Guard.Text(request.Reason, "Applicant-visible reason", 2000);
                item.Status = request.Action == "decline" ? "Declined" : "Cancelled";
                break;
            case "record-celebration" when item.Status is "Scheduled" or "Preparation":
                if (request.CelebratedAt is not { } celebrated || Guard.Utc(celebrated) > op.At)
                    throw new DomainException("invalid_input", "Record the actual celebration time; it cannot be in the future.");
                await CelebrantAsync(item, request, ct);
                item.CelebratedAt = celebrated;
                item.Place = Guard.Text(request.Place, "Place", 300);
                item.Witnesses = string.IsNullOrWhiteSpace(request.Witnesses) ? null : Guard.Text(request.Witnesses, "Witnesses", 1000);
                if (request.Facts is not null) item.Facts = Facts(request.Facts);
                item.Status = "Celebrated";
                break;
            case "amend-facts" when item.Status is not ("Registered" or "Declined" or "Cancelled"):
                if (request.Facts is not null) item.Facts = Facts(request.Facts);
                if (!string.IsNullOrWhiteSpace(request.Place)) item.Place = Guard.Text(request.Place, "Place", 300);
                if (!string.IsNullOrWhiteSpace(request.Witnesses)) item.Witnesses = Guard.Text(request.Witnesses, "Witnesses", 1000);
                item.ReturnReason = null;
                break;
            case "return-entry" when item.Status == "Celebrated":
                item.ReturnReason = note = Guard.Text(request.Reason, "Return reason", 2000);
                break;
            case "register" when item.Status == "Celebrated" && item.ReturnReason is null:
                if (OnceOnly.Contains(item.Kind) && (await CasesAsync(parish, item.PersonId, ct)).Any(r => r.Id != item.Id && r.Kind == item.Kind && r.Status == "Registered"))
                    throw State("This person already has a registered " + item.Kind + " entry.");
                var policy = (await records.ReadAsync<SacramentNumberingPolicy>(Scope(parish), "sacramentPolicy:" + item.Kind, ct))?.Value
                    ?? throw State("No approved numbering scheme exists for this register; the competent authority must supply one first.");
                var year = item.CelebratedAt!.Value.UtcDateTime.Year.ToString(System.Globalization.CultureInfo.InvariantCulture);
                var scope = "sacramentCounter:" + item.Kind + ":" + (policy.PerYear ? year : "all");
                var counter = await records.ReadAsync<SacramentCounter>(Scope(parish), scope, ct);
                var number = counter?.Value.Next ?? 1;
                // The counter changes in the same transaction as the entry, so concurrent registrations can never share or reuse a number.
                changes.Add(counter is null
                    ? RecordChange.Create(scope, "sacramentCounter", new SacramentCounter { Scope = scope, Next = number + 1 })
                    : RecordChange.Replace(scope, "sacramentCounter", new SacramentCounter { Scope = scope, Next = number + 1 }, counter.Version));
                item.OfficialNumber = policy.Format.Replace("{year}", year, StringComparison.Ordinal)
                    .Replace("{n}", number.ToString(System.Globalization.CultureInfo.InvariantCulture), StringComparison.Ordinal);
                item.BookReference = string.IsNullOrWhiteSpace(request.BookReference) ? null : Guard.Text(request.BookReference, "Book reference", 200);
                item.RegisteredBy = actor.AccountId;
                item.RegisteredAt = op.At;
                item.Status = "Registered";
                break;
            default:
                throw State("This action is not available in the case's current state.");
        }
        Step(item, request.Action, from, item.Status, op.At, note, instruction);
        changes.Add(RecordChange.Replace(Key(item.Id), "sacramentRecord", item, Versions.Require(request.Version)));
        await records.CommitAsync(Scope(parish), op, "sacrament." + request.Action.Replace('-', '_'), item.Id, changes, new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return Project(item);
    }

    public async Task<SacramentPolicyDto> SetPolicyAsync(string parish, NumberingPolicyDto request, CancellationToken ct)
    {
        var root = await PriestAsync(parish, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "sacrament-policy:v1:" + request.Sacrament);
        var key = "sacramentPolicy:" + request.Sacrament;
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return Project((await records.ReadAsync<SacramentNumberingPolicy>(Scope(parish), key, ct))!.Value);
        var format = Guard.Text(request.Format, "Format", 100);
        if (!format.Contains("{n}", StringComparison.Ordinal))
            throw new DomainException("invalid_input", "The format must contain {n} for the sequence number.");
        var existing = await records.ReadAsync<SacramentNumberingPolicy>(Scope(parish), key, ct);
        // ponytail: one scheme per register; changing it mid-year needs an explicit migration decision, so it is refused once entries exist.
        if (existing is not null && (await records.PageAsync<SacramentRecord>(Scope(parish), "sacramentRecord", 1, null, ct, Equal("kind", request.Sacrament), Equal("status", "Registered"))).Items.Count > 0)
            throw State("Entries are already registered under the current scheme; changing it needs a separate reviewed migration.");
        var policy = new SacramentNumberingPolicy
        {
            Sacrament = request.Sacrament, Format = format, PerYear = request.PerYear,
            ApprovalReference = Guard.Text(request.ApprovalReference, "Approval reference", 1000), ApprovedBy = actor.AccountId, ApprovedAt = op.At
        };
        await records.CommitAsync(Scope(parish), op, "sacrament.numbering_policy", request.Sacrament,
            [Fence(root), existing is null ? RecordChange.Create(key, "sacramentPolicy", policy) : RecordChange.Replace(key, "sacramentPolicy", policy, existing.Version)],
            new CommandResult { Id = request.Sacrament, Status = "Approved" }, ct);
        return Project(policy);
    }

    public async Task<SacramentCorrectionDto> ProposeCorrectionAsync(string parish, string id, ProposeCorrectionDto request, CancellationToken ct)
    {
        var root = await OfficeAsync(parish, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "sacrament-correction:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } prior)
            return Project((await records.ReadAsync<SacramentCorrection>(Scope(parish), "sacramentCorrection:" + prior.Id, ct))!.Value);
        var item = (await ReadAsync(parish, id, ct)).Value;
        if (item.Status != "Registered")
            throw State("Official corrections apply to registered entries; amend facts before registration instead.");
        var field = Guard.Text(request.Field, "Field", 80);
        if (!CoreFields.Contains(field) && !(field.StartsWith("facts.", StringComparison.Ordinal) && field.Length > 6))
            throw new DomainException("invalid_input", "Correct place, celebrantName, witnesses, bookReference, celebratedAt or facts.<key>.");
        if (field == "celebratedAt" && !DateTimeOffset.TryParse(request.NewValue, System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.AssumeUniversal, out _))
            throw new DomainException("invalid_input", "A corrected celebration time must be an ISO date/time.");
        var correction = new SacramentCorrection
        {
            Id = op.Id, ParishId = parish, RecordId = id, Field = field, NewValue = Guard.Text(request.NewValue, "New value", 2000),
            Reason = Guard.Text(request.Reason, "Reason", 2000), Evidence = Guard.Text(request.Evidence, "Evidence", 1000), ProposedBy = actor.AccountId, ProposedAt = op.At
        };
        await records.CommitAsync(Scope(parish), op, "sacrament.correction_propose", id,
            [Fence(root), RecordChange.Create("sacramentCorrection:" + correction.Id, "sacramentCorrection", correction)], new CommandResult { Id = correction.Id, Status = correction.Status }, ct);
        return Project(correction);
    }

    public async Task<SacramentCorrectionDto> DecideCorrectionAsync(string parish, string correctionId, DecideCorrectionDto request, CancellationToken ct)
    {
        var root = await PriestAsync(parish, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "sacrament-correction-decision:v1:" + correctionId);
        var correctionKey = "sacramentCorrection:" + correctionId;
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return Project((await records.ReadAsync<SacramentCorrection>(Scope(parish), correctionKey, ct))!.Value);
        var row = await records.ReadAsync<SacramentCorrection>(Scope(parish), correctionKey, ct) ?? throw Missing();
        var correction = row.Value;
        if (correction.ParishId != parish || correction.Status != "Pending")
            throw State("Only a pending correction can be decided.");
        var record = await ReadAsync(parish, correction.RecordId, ct);
        correction.Status = request.Approve ? "Approved" : "Rejected";
        correction.DecidedBy = actor.AccountId;
        correction.DecidedAt = op.At;
        correction.DecisionNote = Guard.Text(request.Note, "Decision note", 2000);
        var changes = new List<RecordChange> { Fence(root), RecordChange.Replace(correctionKey, "sacramentCorrection", correction, Versions.Require(request.Version)) };
        if (request.Approve)
        {
            // The approved original stays untouched; the amendment is appended with its previous value, reason and approver.
            var item = record.Value;
            item.Amendments = [.. item.Amendments, new SacramentAmendment
            {
                CorrectionId = correction.Id, Field = correction.Field, OldValue = Current(item).GetValueOrDefault(correction.Field.Replace("facts.", "", StringComparison.Ordinal)),
                NewValue = correction.NewValue, Reason = correction.Reason, Evidence = correction.Evidence, ProposedBy = correction.ProposedBy,
                ApprovedBy = actor.AccountId, ApprovedAt = op.At
            }];
            Step(item, "correction", item.Status, item.Status, op.At, correction.Field);
            changes.Add(RecordChange.Replace(Key(item.Id), "sacramentRecord", item, record.Version));
        }
        await records.CommitAsync(Scope(parish), op, "sacrament.correction_" + (request.Approve ? "approve" : "reject"), correction.RecordId, changes,
            new CommandResult { Id = correction.Id, Status = correction.Status }, ct);
        return Project(correction);
    }

    public async Task<Versioned<SacramentRecordDto>> GetAsync(string parish, string id, CancellationToken ct)
    {
        await OfficeOrPriestAsync(parish, ct);
        var row = await ReadAsync(parish, id, ct);
        return new Versioned<SacramentRecordDto> { Version = row.Version, Value = Project(row.Value) };
    }

    // Read-only register search for authorized staff; there is no competing editable register list.
    public async Task<Page<Versioned<SacramentRecordDto>>> SearchAsync(string parish, string sacrament, string? status, string? person, int size, string? cursor, CancellationToken ct)
    {
        await OfficeOrPriestAsync(parish, ct);
        var conditions = new List<RecordCondition> { Equal("kind", Guard.Text(sacrament, "Sacrament", 40)) };
        if (status is not null) conditions.Add(Equal("status", Guard.Text(status, "Status", 40)));
        if (person is not null) conditions.Add(Equal("personId", person));
        var page = await records.PageAsync<SacramentRecord>(Scope(parish), "sacramentRecord", size, cursor, ct, [.. conditions]);
        return new Page<Versioned<SacramentRecordDto>>
        {
            Items = page.Items.Select(r => new Versioned<SacramentRecordDto> { Version = r.Version, Value = Project(r.Value) }).ToArray(),
            ContinuationToken = page.ContinuationToken
        };
    }

    public async Task<IReadOnlyList<Versioned<SacramentCorrectionDto>>> PendingCorrectionsAsync(string parish, CancellationToken ct)
    {
        await OfficeOrPriestAsync(parish, ct);
        var rows = await records.CollectAsync<SacramentCorrection>(Scope(parish), "sacramentCorrection", ct, 500, Equal("status", "Pending"));
        return rows.Select(r => new Versioned<SacramentCorrectionDto> { Version = r.Version, Value = Project(r.Value) }).ToArray();
    }

    // S11: anniversaries come only from registered entries with a recorded celebration date (amendments applied); nothing is guessed.
    public async Task<IReadOnlyList<SacramentAnniversaryDto>> AnniversariesAsync(string parish, DateOnly from, int days, CancellationToken ct)
    {
        await OfficeOrPriestAsync(parish, ct);
        if (days is < 1 or > 92)
            throw new DomainException("invalid_input", "Choose a window of 1 to 92 days.");
        return await AnniversaryRowsAsync(parish, null, from, days, ct);
    }

    public async Task<IReadOnlyList<SacramentAnniversaryDto>> MyAnniversariesAsync(string parish, CancellationToken ct)
    {
        var link = await own.OwnLinkAsync(parish, ct);
        return await AnniversaryRowsAsync(parish, link.Value.PersonId, DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime), 366, ct);
    }

    private async Task<IReadOnlyList<SacramentAnniversaryDto>> AnniversaryRowsAsync(string parish, string? person, DateOnly from, int days, CancellationToken ct)
    {
        var conditions = new List<RecordCondition> { Equal("status", "Registered") };
        if (person is not null) conditions.Add(Equal("personId", person));
        var people = new Dictionary<string, Person?>(StringComparer.Ordinal);
        var result = new List<SacramentAnniversaryDto>();
        // ponytail: scans the parish's registered entries (cap 5000); add a month/day index when registers grow past that.
        foreach (var row in await records.CollectAsync<SacramentRecord>(Scope(parish), "sacramentRecord", ct, 5000, [.. conditions]))
        {
            var x = row.Value;
            if (!Celebrated.Contains(x.Kind) || !Current(x).TryGetValue("celebratedAt", out var raw)
                || !DateTimeOffset.TryParse(raw, System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out var at))
                continue;
            // The calendar date as recorded where it was celebrated; a travelling viewer does not shift it.
            var date = DateOnly.FromDateTime(at.DateTime);
            var next = Next(date, from);
            if (next > from.AddDays(days))
                continue;
            if (!people.TryGetValue(x.PersonId, out var subject))
                people[x.PersonId] = subject = (await records.ReadAsync<Person>(Scope(parish), "person:" + x.PersonId, ct))?.Value;
            // People recorded as deceased (P02) get no celebratory anniversary.
            if (subject is not { Archived: false } || (await records.ReadAsync<PersonFacts>(Scope(parish), "personFacts:" + x.PersonId, ct))?.Value.DeceasedPrecision is not null)
                continue;
            result.Add(new SacramentAnniversaryDto
            {
                RecordId = x.Id, Sacrament = x.Kind, PersonId = x.PersonId, PersonName = subject.GivenName + " " + subject.FamilyName,
                CelebratedOn = date, NextOn = next, Years = next.Year - date.Year
            });
        }
        return result.OrderBy(a => a.NextOn).ThenBy(a => a.Sacrament, StringComparer.Ordinal).ToArray();
    }

    private static DateOnly Next(DateOnly date, DateOnly from)
    {
        DateOnly In(int year) => new(year, date.Month, Math.Min(date.Day, DateTime.DaysInMonth(year, date.Month)));
        var year = Math.Max(from.Year, date.Year + 1);
        return In(year) >= from ? In(year) : In(year + 1);
    }

    private async Task OfficeOrPriestAsync(string parish, CancellationToken ct)
    {
        if (!await IsPriestAsync(parish, actor.AccountId, ct))
            await OfficeAsync(parish, ct);
        else
            await PriestAsync(parish, ct);
    }

    private async Task CelebrantAsync(SacramentRecord item, SacramentActionDto request, CancellationToken ct)
    {
        if (request.CelebrantAccountId is { } celebrant)
        {
            item.CelebrantAccountId = Guard.Id(celebrant);
            if (!await accounts.IsActiveVerifiedAsync(item.CelebrantAccountId, ct))
                throw new DomainException("invalid_input", "The celebrant account must be active and verified.");
        }
        if (!string.IsNullOrWhiteSpace(request.CelebrantName))
            item.CelebrantName = Guard.Text(request.CelebrantName, "Celebrant", 200);
        if (item.CelebrantAccountId is null && item.CelebrantName is null)
            throw new DomainException("invalid_input", "Name the celebrant.");
    }

    private async Task<List<SacramentRecord>> CasesAsync(string parish, string person, CancellationToken ct)
        => (await records.CollectAsync<SacramentRecord>(Scope(parish), "sacramentRecord", ct, 200, Equal("personId", person))).Select(r => r.Value).ToList();

    private void Step(SacramentRecord item, string action, string from, string to, DateTimeOffset at, string? note, SacramentStep? instruction = null)
    {
        if (item.Timeline.Length >= 100)
            throw State("This case has reached its timeline limit; contact support.");
        item.Timeline = [.. item.Timeline, new SacramentStep
        {
            Action = action, FromStatus = from, ToStatus = to, ActorAccountId = actor.AccountId, At = at, Note = note,
            InstructingPriestAccountId = instruction?.InstructingPriestAccountId, InstructionBasis = instruction?.InstructionBasis,
            InstructionGivenAt = instruction?.InstructionGivenAt
        }];
    }

    private static Dictionary<string, string> Facts(Dictionary<string, string>? facts)
    {
        if (facts is null || facts.Count > 40 || facts.Any(f => f.Key.Length is < 1 or > 60 || f.Key.Any(c => !char.IsAsciiLetterOrDigit(c) && c != '_')
            || f.Value is null || f.Value.Length > 2000))
            throw new DomainException("invalid_input", "Use up to 40 facts with short alphanumeric keys and values up to 2000 characters.");
        return new Dictionary<string, string>(facts, StringComparer.Ordinal);
    }

    internal static Dictionary<string, string> Current(SacramentRecord x)
    {
        var current = new Dictionary<string, string>(x.Facts, StringComparer.Ordinal);
        void Set(string key, string? value) { if (value is not null) current[key] = value; }
        Set("place", x.Place);
        Set("celebrantName", x.CelebrantName);
        Set("witnesses", x.Witnesses);
        Set("bookReference", x.BookReference);
        Set("celebratedAt", x.CelebratedAt?.ToString("O", System.Globalization.CultureInfo.InvariantCulture));
        foreach (var amendment in x.Amendments)
            current[amendment.Field.Replace("facts.", "", StringComparison.Ordinal)] = amendment.NewValue;
        return current;
    }

    private async Task<Versioned<SacramentRecord>> ReadAsync(string parish, string id, CancellationToken ct)
    {
        var row = await records.ReadAsync<SacramentRecord>(Scope(parish), Key(id), ct) ?? throw Missing();
        if (row.Value.Id != id || row.Value.ParishId != parish)
            throw Missing();
        return row;
    }

    private static SacramentRecordDto Project(SacramentRecord x) => new()
    {
        Id = x.Id, Sacrament = x.Kind, SubjectPersonId = x.PersonId, RequestId = x.RequestId, Facts = new(x.Facts), CurrentFacts = Current(x), Status = x.Status,
        TentativeDate = x.TentativeDate, ScheduledAt = x.ScheduledAt, CelebrantAccountId = x.CelebrantAccountId, CelebrantName = x.CelebrantName,
        CelebratedAt = x.CelebratedAt, Place = x.Place, Witnesses = x.Witnesses, ReturnReason = x.ReturnReason, OfficialNumber = x.OfficialNumber,
        BookReference = x.BookReference, RegisteredBy = x.RegisteredBy, RegisteredAt = x.RegisteredAt, Amendments = [.. x.Amendments], Timeline = [.. x.Timeline]
    };

    private static SacramentPolicyDto Project(SacramentNumberingPolicy x) => new()
    {
        Sacrament = x.Sacrament, Format = x.Format, PerYear = x.PerYear, ApprovalReference = x.ApprovalReference, ApprovedBy = x.ApprovedBy, ApprovedAt = x.ApprovedAt
    };

    private static SacramentCorrectionDto Project(SacramentCorrection x) => new()
    {
        Id = x.Id, RecordId = x.RecordId, Field = x.Field, NewValue = x.NewValue, Reason = x.Reason, Evidence = x.Evidence, Status = x.Status,
        ProposedBy = x.ProposedBy, ProposedAt = x.ProposedAt, DecidedBy = x.DecidedBy, DecidedAt = x.DecidedAt, DecisionNote = x.DecisionNote
    };
}
