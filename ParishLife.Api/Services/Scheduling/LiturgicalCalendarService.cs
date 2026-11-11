// Purpose: authority-managed liturgical calendars (X12, proposed S16.11/S01.07). The current bishop of an archdiocese enters a calendar version
// exactly from the competent authority's source (rite, year, source, version, dated entries) and approves it; corrections are reviewed new versions
// that supersede the approved one; approved versions never change. Appointed parish priests may record local exceptions only under an approved
// calendar that permits them. Visitors read approved entries and active exceptions for a parish and date range. Nothing is computed (no Easter or
// season arithmetic) and no feast is built in.
// Main functions: SaveAsync, ActAsync (approve, withdraw), GetAsync, ListAsync, RecordExceptionAsync, WithdrawExceptionAsync, ExceptionsAsync and
// PublicAsync; helpers validate entries, titles and colors.

using System.Security.Cryptography;
using System.Text;
using ParishLife.Api.DTOs.Scheduling;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Services.Scheduling;

public class LiturgicalCalendarService(IRecordTransactions records, IParishRepository parishes, IArchdioceseAuthority bishops, IParishAccess access,
    IClergyAuthority clergy, MfaAccountAccess proof, ICurrentActor actor, TimeProvider clock)
{
    private static readonly string[] Languages = ["en", "fr", "ar"];
    // Technical payload bounds (one Cosmos document), not liturgical policy.
    internal const int MaximumEntries = 1000;
    private const int MaximumExceptionDays = 31;
    private const int MaximumPublicRangeDays = 366;
    private static RecordScope Archdiocese(string id) => new() { Area = RecordArea.Archdiocese, OwnerId = id };
    private static RecordScope Parish(string id) => new() { Area = RecordArea.Parish, OwnerId = id };
    private static string Key(string id) => "liturgicalCalendar:" + id;
    private static string ExceptionKey(string id) => "liturgicalException:" + id;
    private static string SeatKey(string rite, int year)
        => "liturgicalSeat:" + Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rite.Trim().ToLowerInvariant())))[..24] + ":" + year;
    private static RecordCondition Status(string value) => new() { Path = "status", Comparison = "eq", Value = value };
    private static DomainException Missing() => new("resource_not_found", "The requested liturgical calendar is unavailable.", FailureKind.NotFound);
    private static DomainException State(string message) => new("invalid_liturgical_state", message, FailureKind.Conflict);
    private static DomainException Invalid(string message) => new("invalid_input", message);
    private static DomainException Conflict() => new("write_conflict", "The liturgical calendar changed; reload it first.", FailureKind.Conflict);

    public async Task<Versioned<LiturgicalCalendarDto>> SaveAsync(string archdiocese, string id, SaveLiturgicalCalendarDto request, CancellationToken ct)
    {
        await bishops.RequireBishopAsync(archdiocese, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "liturgical-calendar:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Archdiocese(archdiocese), op, ct) is not null)
            return await GetAsync(archdiocese, id, ct);
        var previous = await records.ReadAsync<LiturgicalCalendar>(Archdiocese(archdiocese), Key(id), ct);
        if (previous is not null && (previous.Value.ArchdioceseId != archdiocese || previous.Value.Id != id))
            throw Missing();
        if (previous is null && request.Version is not null || previous is not null && previous.Version != Versions.Require(request.Version))
            throw Conflict();
        if (previous is not null && previous.Value.Status != "Draft")
            throw State("Only a draft can be edited; prepare a correction to change an approved calendar.");
        var value = await ValidateAsync(archdiocese, id, request, op.At, ct);
        await bishops.RequireBishopAsync(archdiocese, ct);
        await records.CommitAsync(Archdiocese(archdiocese), op, "liturgy.calendar_draft", id,
            [previous is null ? RecordChange.Create(Key(id), "liturgicalCalendar", value) : RecordChange.Replace(Key(id), "liturgicalCalendar", value, previous.Version)],
            new CommandResult { Id = id, Status = "Draft" }, ct);
        return await GetAsync(archdiocese, id, ct);
    }

    public async Task<Versioned<LiturgicalCalendarDto>> ActAsync(string archdiocese, string id, LiturgicalActionDto request, CancellationToken ct)
    {
        var bishop = await bishops.RequireBishopAppointmentAsync(archdiocese, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "liturgical-calendar-action:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Archdiocese(archdiocese), op, ct) is not null)
            return await GetAsync(archdiocese, id, ct);
        var row = await ReadAsync(archdiocese, id, ct);
        if (row.Version != Versions.Require(request.Version))
            throw Conflict();
        var item = row.Value;
        var changes = new List<RecordChange>();
        switch (request.Action)
        {
            case "approve" when item.Status == "Draft":
                if (item.Entries.Count == 0)
                    throw State("Enter the authority's dated entries before approval.");
                var seatKey = SeatKey(item.Rite, item.Year);
                var seat = await records.ReadAsync<LiturgicalCalendarSeat>(Archdiocese(archdiocese), seatKey, ct);
                var current = seat is null ? null : await records.ReadAsync<LiturgicalCalendar>(Archdiocese(archdiocese), Key(seat.Value.CalendarId), ct);
                if (item.CorrectsCalendarId is { } corrected)
                {
                    if (current?.Value.Id != corrected || current.Value.Status != "Approved")
                        throw State("The calendar this corrects is no longer the approved version for its rite and year.");
                    current.Value.Status = "Superseded";
                    current.Value.SupersededBy = item.Id;
                    changes.Add(RecordChange.Replace(Key(corrected), "liturgicalCalendar", current.Value, current.Version));
                }
                else if (current?.Value.Status == "Approved")
                    throw State("An approved calendar already exists for this rite and year; prepare a correction of it instead.");
                var pointer = new LiturgicalCalendarSeat { CalendarId = item.Id };
                changes.Add(seat is null ? RecordChange.Create(seatKey, "liturgicalCalendarSeat", pointer) : RecordChange.Replace(seatKey, "liturgicalCalendarSeat", pointer, seat.Version));
                item.Status = "Approved";
                item.ApprovedBy = actor.AccountId;
                item.ApprovalAppointmentId = bishop.Value.Id;
                item.ApprovedAt = op.At;
                item.ApprovalNote = string.IsNullOrWhiteSpace(request.Reason) ? null : Guard.Text(request.Reason, "Approval note", 1000);
                break;
            case "withdraw" when item.Status == "Approved":
                item.Status = "Withdrawn";
                item.WithdrawnReason = Guard.Text(request.Reason, "Reason", 1000);
                item.WithdrawnBy = actor.AccountId;
                item.WithdrawnAt = op.At;
                break;
            default:
                throw State("That action is not available for a " + item.Status + " calendar.");
        }
        changes.Add(RecordChange.Replace(Key(id), "liturgicalCalendar", item, row.Version));
        await bishops.RequireBishopAsync(archdiocese, ct);
        await records.CommitAsync(Archdiocese(archdiocese), op, "liturgy.calendar_" + request.Action, id, changes, new CommandResult { Id = id, Status = item.Status }, ct);
        return await GetAsync(archdiocese, id, ct);
    }

    public async Task<Versioned<LiturgicalCalendarDto>> GetAsync(string archdiocese, string id, CancellationToken ct)
    {
        await bishops.RequireBishopAsync(archdiocese, ct);
        var row = await ReadAsync(archdiocese, id, ct);
        return new Versioned<LiturgicalCalendarDto> { Version = row.Version, Value = Project(row.Value) };
    }

    public async Task<IReadOnlyList<Versioned<LiturgicalCalendarDto>>> ListAsync(string archdiocese, CancellationToken ct)
    {
        await bishops.RequireBishopAsync(archdiocese, ct);
        return (await records.CollectAsync<LiturgicalCalendar>(Archdiocese(archdiocese), "liturgicalCalendar", ct, 500))
            .Where(r => r.Value.ArchdioceseId == archdiocese).OrderByDescending(r => r.Value.Year).ThenByDescending(r => r.Value.PreparedAt)
            .Select(r => new Versioned<LiturgicalCalendarDto> { Version = r.Version, Value = Project(r.Value) }).ToArray();
    }

    public async Task<Versioned<LiturgicalExceptionDto>> RecordExceptionAsync(string parish, SaveLiturgicalExceptionDto request, CancellationToken ct)
    {
        var root = await PriestAsync(parish, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "liturgical-exception:v1");
        if (await records.ReplayAsync<CommandResult>(Parish(parish), op, ct) is { } prior)
            return await ExceptionAsync(parish, prior.Id, ct);
        var archdiocese = root.Value.JurisdictionArchdioceseId ?? throw State("This parish has no confirmed jurisdiction.");
        var calendar = (await records.ReadAsync<LiturgicalCalendar>(Archdiocese(archdiocese), Key(Guard.Id(request.CalendarId)), ct))?.Value;
        if (calendar is null || calendar.ArchdioceseId != archdiocese || calendar.Status != "Approved")
            throw State("Choose a currently approved calendar of this parish's archdiocese.");
        if (!calendar.AllowsParishExceptions)
            throw State("The approved calendar does not permit parish exceptions.");
        var from = request.EffectiveFrom ?? throw Invalid("EffectiveFrom is required.");
        var to = request.EffectiveTo ?? from;
        if (to < from || to.DayNumber - from.DayNumber >= MaximumExceptionDays || from < calendar.ValidFrom || to > calendar.ValidTo)
            throw Invalid("Use effective dates inside the approved calendar's period, ending on or after they start and spanning at most " + MaximumExceptionDays + " days.");
        var value = new LiturgicalException
        {
            Id = op.Id, ParishId = parish, ArchdioceseId = archdiocese, CalendarId = calendar.Id, EffectiveFrom = from, EffectiveTo = to,
            Titles = Titles(request.Titles), Reason = Guard.Text(request.Reason, "Reason", 1000), RecordedBy = actor.AccountId, RecordedAt = op.At
        };
        root = await PriestAsync(parish, ct);
        await records.CommitAsync(Parish(parish), op, "liturgy.exception_record", value.Id,
            [RecordChange.Replace("parish", "parish", root.Value, root.Version), RecordChange.Create(ExceptionKey(value.Id), "liturgicalException", value)],
            new CommandResult { Id = value.Id, Status = value.Status }, ct);
        return await ExceptionAsync(parish, value.Id, ct);
    }

    public async Task<Versioned<LiturgicalExceptionDto>> WithdrawExceptionAsync(string parish, string id, LiturgicalActionDto request, CancellationToken ct)
    {
        var root = await PriestAsync(parish, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "liturgical-exception-withdraw:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Parish(parish), op, ct) is not null)
            return await ExceptionAsync(parish, id, ct);
        if (request.Action != "withdraw")
            throw Invalid("A parish exception can only be withdrawn.");
        var row = await ReadExceptionAsync(parish, id, ct);
        if (row.Version != Versions.Require(request.Version))
            throw Conflict();
        if (row.Value.Status != "Active")
            throw State("This exception is already withdrawn.");
        row.Value.Status = "Withdrawn";
        row.Value.WithdrawnReason = Guard.Text(request.Reason, "Reason", 1000);
        row.Value.WithdrawnBy = actor.AccountId;
        row.Value.WithdrawnAt = op.At;
        await records.CommitAsync(Parish(parish), op, "liturgy.exception_withdraw", id,
            [RecordChange.Replace("parish", "parish", root.Value, root.Version), RecordChange.Replace(ExceptionKey(id), "liturgicalException", row.Value, row.Version)],
            new CommandResult { Id = id, Status = "Withdrawn" }, ct);
        return await ExceptionAsync(parish, id, ct);
    }

    public async Task<IReadOnlyList<Versioned<LiturgicalExceptionDto>>> ExceptionsAsync(string parish, CancellationToken ct)
    {
        await PriestAsync(parish, ct);
        return (await records.CollectAsync<LiturgicalException>(Parish(parish), "liturgicalException", ct, 500)).Where(r => r.Value.ParishId == parish)
            .OrderBy(r => r.Value.EffectiveFrom).Select(r => new Versioned<LiturgicalExceptionDto> { Version = r.Version, Value = Project(r.Value) }).ToArray();
    }

    // Visitors see approved authority entries and active parish exceptions (flagged), never drafts, superseded or withdrawn versions, reasons or
    // editor identities. A missing calendar is reported as NotPublished rather than as an empty liturgical year.
    public async Task<PublicLiturgicalCalendarDto> PublicAsync(string parish, DateOnly? from, DateOnly? to, string? language, CancellationToken ct)
    {
        var root = await parishes.GetAsync(parish, ct);
        if (root?.Value.Status != ParishStatus.Verified)
            throw Missing();
        var lang = language is null ? "en" : Languages.Contains(language) ? language : throw Invalid("Choose en, fr or ar.");
        var start = from ?? DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
        var end = to ?? start.AddDays(30);
        if (end < start || end.DayNumber - start.DayNumber >= MaximumPublicRangeDays)
            throw Invalid("Use a date range of at most " + MaximumPublicRangeDays + " days.");
        var result = new PublicLiturgicalCalendarDto { ParishId = parish, From = start, To = end };
        if (root.Value.JurisdictionArchdioceseId is not { } archdiocese || (await parishes.GetArchdioceseAsync(archdiocese, ct))?.Value.Verified != true)
            return result;
        var calendars = (await records.CollectAsync<LiturgicalCalendar>(Archdiocese(archdiocese), "liturgicalCalendar", ct, 500, Status("Approved")))
            .Select(r => r.Value).Where(c => c.ArchdioceseId == archdiocese && c.Status == "Approved").ToDictionary(c => c.Id);
        if (calendars.Count == 0)
            return result;
        var days = new List<PublicLiturgicalDayDto>();
        foreach (var calendar in calendars.Values)
            foreach (var entry in calendar.Entries.Where(e => e.Date >= start && e.Date <= end))
                days.Add(Day(calendar, entry.Date, entry.Titles, lang, entry.Rank, entry.Season, entry.DisplayColor, false));
        foreach (var exception in (await records.CollectAsync<LiturgicalException>(Parish(parish), "liturgicalException", ct, 500, Status("Active"))).Select(r => r.Value))
            if (exception.ParishId == parish && exception.Status == "Active" && calendars.TryGetValue(exception.CalendarId, out var calendar))
                for (var day = exception.EffectiveFrom < start ? start : exception.EffectiveFrom; day <= exception.EffectiveTo && day <= end; day = day.AddDays(1))
                    days.Add(Day(calendar, day, exception.Titles, lang, null, null, null, true));
        result.Status = "Published";
        result.Days = [.. days.OrderBy(d => d.Date).ThenBy(d => d.ParishException).ThenBy(d => d.Rite, StringComparer.Ordinal)];
        return result;
    }

    private static PublicLiturgicalDayDto Day(LiturgicalCalendar calendar, DateOnly date, Dictionary<string, string> titles, string lang,
        string? rank, string? season, string? color, bool parishException)
    {
        var served = titles.ContainsKey(lang) ? lang : titles.ContainsKey("en") ? "en" : titles.Keys.Order(StringComparer.Ordinal).First();
        return new PublicLiturgicalDayDto
        {
            Date = date, Title = titles[served], Language = served, Rank = rank, Season = season, DisplayColor = color, Rite = calendar.Rite,
            Source = calendar.Source, CalendarVersion = calendar.VersionLabel, CalendarId = calendar.Id, ParishException = parishException
        };
    }

    private async Task<Versioned<Parish>> PriestAsync(string parish, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        var root = await access.RequireAsync(parish, Permissions.SchedulePublish, ct);
        await clergy.RequireAsync(parish, actor.AccountId, "Priest", ct);
        return root;
    }

    private async Task<LiturgicalCalendar> ValidateAsync(string archdiocese, string id, SaveLiturgicalCalendarDto request, DateTimeOffset at, CancellationToken ct)
    {
        var from = request.ValidFrom ?? throw Invalid("ValidFrom is required.");
        var to = request.ValidTo ?? throw Invalid("ValidTo is required.");
        if (to < from || to.DayNumber - from.DayNumber > 800)
            throw Invalid("Use a calendar period that ends after it starts and covers at most about two years.");
        if (request.Year is < 1900 or > 2200)
            throw Invalid("Use the calendar's year.");
        if (request.Entries is null || request.Entries.Length > MaximumEntries)
            throw Invalid("A calendar version holds at most " + MaximumEntries + " entries.");
        var value = new LiturgicalCalendar
        {
            Id = id, ArchdioceseId = archdiocese, Rite = Guard.Text(request.Rite, "Rite", 120), Year = request.Year, Source = Guard.Text(request.Source, "Source", 500),
            VersionLabel = Guard.Text(request.VersionLabel, "Version label", 60), ValidFrom = from, ValidTo = to,
            AllowsParishExceptions = request.AllowsParishExceptions ?? throw Invalid("State whether the authority permits parish exceptions."),
            PreparedBy = actor.AccountId, PreparedAt = at,
            Entries = request.Entries.Select(e => new LiturgicalEntry
            {
                Date = e.Date is { } date && date >= from && date <= to ? date : throw Invalid("Every entry needs a date inside the calendar's period."),
                Titles = Titles(e.Titles), Rank = Optional(e.Rank, "Rank"), Season = Optional(e.Season, "Season"), DisplayColor = Color(e.DisplayColor)
            }).OrderBy(e => e.Date).ToList()
        };
        if (request.CorrectsCalendarId is { } corrects)
        {
            var target = (await records.ReadAsync<LiturgicalCalendar>(Archdiocese(archdiocese), Key(Guard.Id(corrects)), ct))?.Value;
            if (target is null || target.ArchdioceseId != archdiocese || target.Status != "Approved" || target.Year != value.Year
                || !string.Equals(target.Rite.Trim(), value.Rite, StringComparison.OrdinalIgnoreCase) || target.Id == id)
                throw State("A correction must name the currently approved calendar of the same rite and year.");
            value.CorrectsCalendarId = target.Id;
            value.CorrectionReason = Guard.Text(request.CorrectionReason, "Correction reason", 1000);
        }
        return value;
    }

    private static Dictionary<string, string> Titles(Dictionary<string, string>? titles)
    {
        if (titles is null || titles.Count == 0 || titles.Keys.Any(l => !Languages.Contains(l)))
            throw Invalid("Give each title in en, fr and/or ar.");
        return titles.ToDictionary(t => t.Key, t => Plain(t.Value, "Title", 200));
    }

    private static string? Optional(string? value, string name) => string.IsNullOrWhiteSpace(value) ? null : Plain(value, name, 80);

    private static string Plain(string? value, string name, int maximum)
    {
        var text = Guard.Text(value, name, maximum);
        return text.Any(char.IsControl) ? throw Invalid(name + " must be plain text.") : text;
    }

    private static string? Color(string? value)
        => string.IsNullOrWhiteSpace(value) ? null
            : value.Length == 7 && value[0] == '#' && value.Skip(1).All(char.IsAsciiHexDigit) ? value.ToUpperInvariant()
            : throw Invalid("Display colors must be #RRGGBB.");

    private async Task<Versioned<LiturgicalCalendar>> ReadAsync(string archdiocese, string id, CancellationToken ct)
        => await records.ReadAsync<LiturgicalCalendar>(Archdiocese(archdiocese), Key(id), ct) is { } row && row.Value.ArchdioceseId == archdiocese && row.Value.Id == id
            ? row : throw Missing();

    private async Task<Versioned<LiturgicalException>> ReadExceptionAsync(string parish, string id, CancellationToken ct)
        => await records.ReadAsync<LiturgicalException>(Parish(parish), ExceptionKey(id), ct) is { } row && row.Value.ParishId == parish && row.Value.Id == id
            ? row : throw Missing();

    private async Task<Versioned<LiturgicalExceptionDto>> ExceptionAsync(string parish, string id, CancellationToken ct)
    {
        var row = await ReadExceptionAsync(parish, id, ct);
        return new Versioned<LiturgicalExceptionDto> { Version = row.Version, Value = Project(row.Value) };
    }

    private static LiturgicalCalendarDto Project(LiturgicalCalendar x) => new()
    {
        Id = x.Id, ArchdioceseId = x.ArchdioceseId, Rite = x.Rite, Year = x.Year, Source = x.Source, VersionLabel = x.VersionLabel, ValidFrom = x.ValidFrom,
        ValidTo = x.ValidTo, AllowsParishExceptions = x.AllowsParishExceptions, Status = x.Status, CorrectsCalendarId = x.CorrectsCalendarId,
        CorrectionReason = x.CorrectionReason, SupersededBy = x.SupersededBy, PreparedBy = x.PreparedBy, PreparedAt = x.PreparedAt, ApprovedBy = x.ApprovedBy,
        ApprovedAt = x.ApprovedAt, ApprovalNote = x.ApprovalNote, WithdrawnReason = x.WithdrawnReason,
        Entries = [.. x.Entries.Select(e => new LiturgicalEntryDto
        {
            Date = e.Date, Titles = new Dictionary<string, string>(e.Titles), Rank = e.Rank, Season = e.Season, DisplayColor = e.DisplayColor
        })]
    };

    private static LiturgicalExceptionDto Project(LiturgicalException x) => new()
    {
        Id = x.Id, CalendarId = x.CalendarId, EffectiveFrom = x.EffectiveFrom, EffectiveTo = x.EffectiveTo, Titles = new Dictionary<string, string>(x.Titles),
        Reason = x.Reason, Status = x.Status, RecordedBy = x.RecordedBy, RecordedAt = x.RecordedAt, WithdrawnReason = x.WithdrawnReason
    };
}
