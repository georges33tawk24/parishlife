// Purpose: manages manual calendar drafts, dated lifecycle/publication and local-wall-time recurrence with privacy-safe projections.
// Main functions: SaveAsync, ActAsync, GetAsync, ListAsync, PublicAsync and CreateSeriesAsync; helpers enforce source boundaries and preserve private busy intervals.

using System.Security.Cryptography;
using System.Text;
using ParishLife.Api.DTOs.Scheduling;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Scheduling;

public class CalendarService(IRecordTransactions records, IParishRepository parishes, IParishAccess access, ICurrentActor actor, TimeProvider clock)
{
    private async Task<Versioned<Parish>> Authorize(string parish, string permission, CancellationToken ct, bool requireModule = true)
    {
        var row = await access.RequireAsync(parish, permission, ct);
        if (requireModule)
            await access.RequireModuleAsync(parish, "core", ct);
        return row;
    }

    public async Task<CalendarEventDto> SaveAsync(string parish, string? id, SaveEventDto request, CancellationToken ct)
    {
        var root = await Authorize(parish, Permissions.ScheduleManage, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "event:" + id);
        if (await records.ReplayAsync<CalendarEvent>(SchedulingScope.For(parish), op, ct) is { } replay)
            return View((await SchedulingScope.ReadEventAsync(records, parish, replay.Id, ct)).Value);
        var value = Draft(parish, id ?? op.Id, request);
        var old = id is null ? null : await SchedulingScope.ReadEventAsync(records, parish, id, ct);
        if (old is not null)
        {
            SchedulingScope.RequireEditableEvent(old.Value, actor.AccountId);
            if (old.Value.Status != "Draft" || (await SchedulingScope.ReservationsAsync(records, parish, id!, ct)).Any(row => !SchedulingScope.IsEnded(row.Value)))
                throw new DomainException("event_dependencies_active", "Resolve linked reservations and use a draft before changing event details.", FailureKind.Conflict);
            value.CreatedBy = old.Value.CreatedBy;
            value.SeriesId = old.Value.SeriesId;
        }
        await records.CommitAsync(SchedulingScope.For(parish), op, "calendar.save_draft", value.Id,
            [SchedulingScope.Fence(root), old is null ? RecordChange.Create("event:" + value.Id, "event", value)
                : RecordChange.Replace("event:" + value.Id, "event", value, Versions.Require(request.Version))], value, ct);
        return View(value);
    }

    public async Task<CalendarEventDto> ActAsync(string parish, string id, EventActionDto request, CancellationToken ct)
    {
        var root = await Authorize(parish, request.Action is "publish" or "unpublish" ? Permissions.SchedulePublish : Permissions.ScheduleManage, ct,
            requireModule: request.Action is not ("cancel" or "unpublish"));
        var op = actor.CreateOperation(request.OperationId, request, clock, "event:" + id);
        if (await records.ReplayAsync<CalendarEvent>(SchedulingScope.For(parish), op, ct) is not null)
            return View((await SchedulingScope.ReadEventAsync(records, parish, id, ct)).Value);
        var row = await SchedulingScope.ReadEventAsync(records, parish, id, ct);
        var value = row.Value;
        SchedulingScope.RequireEditableEvent(value, actor.AccountId);
        switch (request.Action)
        {
            case "confirm":
                if (value.Status != "Draft" || value.StartsAt <= clock.GetUtcNow())
                    throw State();
                if ((await SchedulingScope.ReservationsAsync(records, parish, id, ct)).Any(item => item.Value.Status is not ("Confirmed" or "Cancelled" or "Declined")))
                    throw new DomainException("allocations_pending", "Resolve linked reservations before confirming the calendar occurrence.", FailureKind.Conflict);
                value.Status = "Confirmed";
                break;
            case "publish":
                if (value.Status != "Confirmed" || value.Visibility != "Public")
                    throw State();
                value.Published = true;
                break;
            case "unpublish":
                Guard.Text(request.Reason, "Unpublication reason", 2000);
                if (!value.Published)
                    throw State();
                value.Published = false;
                break;
            case "cancel":
                Guard.Text(request.Reason, "Cancellation reason", 2000);
                if (value.Status == "Cancelled" || value.StartsAt <= clock.GetUtcNow())
                    throw State();
                if ((await SchedulingScope.ReservationsAsync(records, parish, id, ct)).Any(item => !SchedulingScope.IsEnded(item.Value)))
                    throw new DomainException("reservations_active", "End linked reservations before cancelling their occurrence.", FailureKind.Conflict);
                value.Status = "Cancelled";
                break;
            default:
                throw new DomainException("invalid_action", "Use confirm, publish, unpublish or cancel.");
        }
        value.LastActionReason = string.IsNullOrWhiteSpace(request.Reason) ? null : Guard.Text(request.Reason, "Action reason", 2000);
        await records.CommitAsync(SchedulingScope.For(parish), op, "calendar." + request.Action, id,
            [SchedulingScope.Fence(root), RecordChange.Replace("event:" + id, "event", value, Versions.Require(request.Version))], value, ct);
        return View(value);
    }

    public async Task<Versioned<CalendarEventDto>> GetAsync(string parish, string id, CancellationToken ct)
    {
        await Authorize(parish, Permissions.ScheduleRead, ct, requireModule: false);
        var row = await SchedulingScope.ReadEventAsync(records, parish, id, ct);
        var view = View(row.Value);
        return new() { Value = view, Version = view.Redacted ? string.Empty : row.Version };
    }

    public async Task<Page<Versioned<CalendarEventDto>>> ListAsync(string parish, DateTimeOffset start, DateTimeOffset end, int size, string? cursor, CancellationToken ct)
    {
        await Authorize(parish, Permissions.ScheduleRead, ct);
        ScheduleRules.ValidatePeriod(start, end);
        var page = await records.PageAsync<CalendarEvent>(SchedulingScope.For(parish), "event", size, cursor, ct, Window(start, end));
        return new() { Items = page.Items.Select(row => { var view = View(row.Value); return new Versioned<CalendarEventDto> { Value = view, Version = view.Redacted ? string.Empty : row.Version }; }).ToArray(), ContinuationToken = page.ContinuationToken };
    }

    public async Task<Page<PublicCalendarEventDto>> PublicAsync(string parish, DateTimeOffset start, DateTimeOffset end, int size, string? cursor, CancellationToken ct)
    {
        ScheduleRules.ValidatePeriod(start, end);
        if (size is < 1 or > 100)
            throw new DomainException("invalid_page", "Use 1–100 rows.");
        if ((await parishes.GetAsync(parish, ct))?.Value.Status != ParishStatus.Verified)
            return new() { Items = [], ContinuationToken = null };
        var filters = Window(start, end).Concat(new[]
        {
            new RecordCondition { Path = "published", Comparison = "eq", Value = true },
            new RecordCondition { Path = "visibility", Comparison = "eq", Value = "Public" },
            new RecordCondition { Path = "status", Comparison = "in", Value = new[] { "Confirmed", "Cancelled" } }
        }).ToArray();
        var page = await records.PageAsync<CalendarEvent>(SchedulingScope.For(parish), "event", size, cursor, ct, filters);
        return new()
        {
            Items = page.Items.Where(row => row.Value.Kind == "ParishActivity" && row.Value.SourceType is null && row.Value.SourceId is null
            && row.Value.MinistryId is null && row.Value.ClergyAccountIds?.Length is not > 0).Select(row => new PublicCalendarEventDto
            {
                Id = row.Value.Id,
                ParishId = parish,
                Title = row.Value.Title,
                Kind = row.Value.Kind,
                StartsAt = row.Value.StartsAt,
                EndsAt = row.Value.EndsAt,
                TimeZone = row.Value.TimeZone,
                Description = row.Value.Description,
                Status = row.Value.Status
            }).ToArray(),
            ContinuationToken = page.ContinuationToken
        };
    }

    public async Task<IReadOnlyList<CalendarEventDto>> CreateSeriesAsync(string parish, CreateSeriesDto request, CancellationToken ct)
    {
        var root = await Authorize(parish, Permissions.ScheduleManage, ct);
        if (request.Count is < 1 or > 52 || request.IntervalDays is < 1 or > 366)
            throw new DomainException("invalid_series", "Use 1–52 occurrences and a 1–366 day interval.");
        var op = actor.CreateOperation(request.OperationId, request, clock, "manual-calendar-series:v2");
        if (await records.ReplayAsync<SeriesResult>(SchedulingScope.For(parish), op, ct) is { } prior)
        {
            var current = new List<CalendarEventDto>();
            foreach (var id in prior.Ids)
                current.Add(View((await SchedulingScope.ReadEventAsync(records, parish, id, ct)).Value));
            return current;
        }
        var zone = Zone(request.TimeZone);
        var localStart = TimeZoneInfo.ConvertTime(request.StartsAt, zone).DateTime;
        var localEnd = TimeZoneInfo.ConvertTime(request.EndsAt, zone).DateTime;
        var events = new List<CalendarEvent>();
        for (var i = 0; i < request.Count; i++)
        {
            DateTimeOffset start, end;
            try
            {
                start = i == 0 ? request.StartsAt : Instant(localStart.AddDays(checked(i * request.IntervalDays)), zone);
                end = i == 0 ? request.EndsAt : Instant(localEnd.AddDays(checked(i * request.IntervalDays)), zone);
            }
            catch (ArgumentOutOfRangeException) { throw new DomainException("invalid_series", "The recurrence exceeds the supported date range."); }
            var id = new Guid(SHA256.HashData(Encoding.UTF8.GetBytes(op.Id + ":" + i)).AsSpan(0, 16)).ToString("N");
            var value = Draft(parish, id, new SaveEventDto { Title = request.Title, Kind = request.Kind, StartsAt = start, EndsAt = end, TimeZone = request.TimeZone, Visibility = request.Visibility, Description = request.Description });
            value.SeriesId = op.Id;
            events.Add(value);
        }
        var result = new SeriesResult(events.Select(value => value.Id).ToArray());
        await records.CommitAsync(SchedulingScope.For(parish), op, "calendar.create_series", op.Id,
            events.Select(value => RecordChange.Create("event:" + value.Id, "event", value)).Prepend(SchedulingScope.Fence(root)).ToArray(), result, ct);
        return events.Select(View).ToArray();
    }

    private sealed record SeriesResult(string[] Ids);
    private CalendarEvent Draft(string parish, string id, SaveEventDto request)
    {
        ScheduleRules.ValidatePeriod(request.StartsAt, request.EndsAt);
        _ = Zone(request.TimeZone);
        if (request.Kind is not ("ParishActivity" or "Appointment" or "ResourceBlock") || request.SourceType is not null || request.SourceId is not null
            || request.MinistryId is not null || request.ClergyAccountIds?.Length > 0)
            throw new DomainException("source_command_required", "Manual drafts support ParishActivity, Appointment and ResourceBlock. Official, clergy and ministry records require their owning workflow.");
        if (request.Visibility is not ("Public" or "Parish" or "Private") || request.Kind is "Appointment" or "ResourceBlock" && request.Visibility != "Private")
            throw new DomainException("invalid_visibility", "Choose an explicit supported audience; appointments and resource blocks remain private.");
        return new()
        {
            Id = id,
            ParishId = parish,
            Title = Guard.Text(request.Title, "Title", 500),
            Kind = request.Kind,
            StartsAt = request.StartsAt,
            EndsAt = request.EndsAt,
            TimeZone = request.TimeZone,
            Visibility = request.Visibility,
            Status = "Draft",
            CreatedBy = actor.AccountId,
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : Guard.Text(request.Description, "Description", 10000),
            ClergyAccountIds = []
        };
    }
    private CalendarEventDto View(CalendarEvent value)
    {
        var hidden = value.Visibility == "Private" && value.CreatedBy != actor.AccountId || value.Visibility == "Ministry";
        return new()
        {
            Id = value.Id,
            ParishId = value.ParishId,
            Title = hidden ? "Busy" : value.Title,
            Kind = hidden ? "Busy" : value.Kind,
            StartsAt = value.StartsAt,
            EndsAt = value.EndsAt,
            TimeZone = value.TimeZone,
            Visibility = hidden ? "Private" : value.Visibility,
            Status = hidden ? value.Status switch { "Draft" => "Tentative", "Confirmed" => "Busy", "Cancelled" => "Cancelled", _ => "Restricted" } : value.Status,
            Published = !hidden && value.Published,
            Redacted = hidden,
            CreatedBy = hidden ? null : value.CreatedBy,
            SeriesId = hidden ? null : value.SeriesId,
            Description = hidden ? null : value.Description,
            LastActionReason = hidden ? null : value.LastActionReason
        };
    }
    private static RecordCondition[] Window(DateTimeOffset start, DateTimeOffset end) =>
        [new() { Path = "startsAt", Comparison = "lt", Value = end }, new() { Path = "endsAt", Comparison = "gt", Value = start }];
    private static TimeZoneInfo Zone(string id)
    {
        try
        { return TimeZoneInfo.FindSystemTimeZoneById(Guard.Text(id, "Time zone", 100)); }
        catch (Exception error) when (error is TimeZoneNotFoundException or InvalidTimeZoneException) { throw new DomainException("invalid_time_zone", "Use a recognized time-zone identifier."); }
    }
    private static DateTimeOffset Instant(DateTime local, TimeZoneInfo zone)
    {
        if (zone.IsInvalidTime(local) || zone.IsAmbiguousTime(local))
            throw new DomainException("recurrence_time_requires_review", "A recurrence reaches a missing or ambiguous local time. Create explicitly timed occurrences for that transition.");
        return new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(local, DateTimeKind.Unspecified), zone), TimeSpan.Zero);
    }
    private static DomainException State() => new("invalid_event_state", "This action is unavailable for the current event state or historical time.", FailureKind.Conflict);
}
