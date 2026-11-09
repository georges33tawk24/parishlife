// Purpose: owns ministry meeting/calendar changes and personal RSVP without creating attendance or bypassing resource allocation.
// Main functions: SaveAsync, ActAsync, GetAsync, ListAsync, RsvpAsync, OwnRsvpAsync, RsvpsAsync and HistoryAsync;
// helpers enforce current group audience, exact source ownership, bounded dates, current-state replay projections and atomic parish fences.

using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Scheduling;

namespace ParishLife.Api.Services.Ministries;

public class MinistryMeetingService(IRecordTransactions records, MinistryAccess access, ICurrentActor actor, TimeProvider clock)
{
    public async Task<MinistryMeetingDto> SaveAsync(string parish, string ministry, string? id, SaveMinistryMeetingDto request, CancellationToken ct)
    {
        var root = await access.RootAsync(parish, ct);
        var group = await access.LeaderAsync(parish, ministry, ct, requireModule: false);
        var scope = MinistryAccess.Scope(parish);
        var op = actor.CreateOperation(request.OperationId, request, clock, "ministry-meeting:v1:" + ministry + ":" + id);
        if (await records.ReplayAsync<CommandResult>(scope, op, ct) is { } prior)
            return await CurrentViewAsync(parish, ministry, prior.Id, ct);
        await access.ModuleAsync(parish, ct);
        RequireActive(group.Value);
        var old = id is null ? null : await ReadAsync(parish, ministry, id, ct);
        Versioned<CalendarEvent>? occurrence = null;
        if (old is not null)
        {
            occurrence = await EventAsync(parish, old.Value, ct);
            if (old.Value.Status != "Draft" || old.Value.StartsAt <= clock.GetUtcNow())
                throw State("Only a future draft can be edited; confirmed or historical occurrences require their explicit lifecycle.");
            await RequireNoReservationsAsync(parish, old.Value.EventId, ct);
        }
        var value = Draft(parish, ministry, id ?? op.Id, request, old?.Value, op);
        var calendar = Event(value);
        var changes = new List<RecordChange>
        {
            MinistryAccess.Fence(root), GroupFence(group),
            old is null ? RecordChange.Create(Key(value.Id), "ministryMeeting", value)
                : RecordChange.Replace(Key(value.Id), "ministryMeeting", value, Versions.Require(request.Version)),
            occurrence is null ? RecordChange.Create("event:" + value.EventId, "event", calendar)
                : RecordChange.Replace("event:" + value.EventId, "event", calendar, occurrence.Version),
            History(value, "save-draft", op, null)
        };
        await records.CommitAsync(scope, op, "ministry.meeting_save", value.Id, changes, Result(value), ct);
        return await CurrentViewAsync(parish, ministry, value.Id, ct);
    }

    public async Task<MinistryMeetingDto> ActAsync(string parish, string ministry, string id, MinistryMeetingActionDto request, CancellationToken ct)
    {
        if (request.Action is not ("confirm" or "cancel")) throw State("Use confirm or cancel for a ministry meeting.");
        var root = await access.RootAsync(parish, ct);
        var group = await access.LeaderAsync(parish, ministry, ct, requireModule: false);
        var scope = MinistryAccess.Scope(parish);
        var op = actor.CreateOperation(request.OperationId, request, clock, "ministry-meeting-action:v1:" + ministry + ":" + id);
        if (await records.ReplayAsync<CommandResult>(scope, op, ct) is not null)
            return await CurrentViewAsync(parish, ministry, id, ct);
        if (request.Action == "confirm") await access.ModuleAsync(parish, ct);
        var row = await ReadAsync(parish, ministry, id, ct);
        var occurrence = await EventAsync(parish, row.Value, ct);
        var value = row.Value;
        if (value.StartsAt <= op.At || value.Status is not ("Draft" or "Confirmed"))
            throw State("Use a future draft or confirmed meeting; historical occurrences cannot be silently changed.");
        if (request.Action == "confirm")
        {
            RequireActive(group.Value);
            if (value.Status != "Draft") throw State("Only a draft can be confirmed.");
            if ((await SchedulingScope.ReservationsAsync(records, parish, value.EventId, ct))
                .Any(item => item.Value.Status is not ("Confirmed" or "Cancelled" or "Declined")))
                throw State("Resolve every linked reservation before confirming this occurrence.");
            value.Status = "Confirmed";
            value.ConfirmedAt = op.At;
        }
        else
        {
            Guard.Text(request.Reason, "Cancellation reason", 2000);
            await RequireNoReservationsAsync(parish, value.EventId, ct);
            value.Status = "Cancelled";
            value.CancelledAt = op.At;
        }
        var calendar = occurrence.Value;
        calendar.Status = value.Status;
        calendar.Published = false;
        await records.CommitAsync(scope, op, "ministry.meeting_" + request.Action, id,
            [MinistryAccess.Fence(root), GroupFence(group),
                RecordChange.Replace(Key(id), "ministryMeeting", value, Versions.Require(request.Version)),
                RecordChange.Replace("event:" + value.EventId, "event", calendar, occurrence.Version),
                History(value, request.Action, op, request.Reason)], Result(value), ct);
        return await CurrentViewAsync(parish, ministry, id, ct);
    }

    public async Task<Versioned<MinistryMeetingDto>> GetAsync(string parish, string ministry, string id, CancellationToken ct)
    {
        var reader = await ReaderAsync(parish, ministry, ct);
        var row = await ReadAsync(parish, ministry, id, ct);
        RequireVisible(row.Value, reader);
        return new()
        {
            Version = reader.Privileged ? row.Version : string.Empty,
            Value = View(row.Value, reader.Privileged, reader.Group.Value.Status == "Active" && await ModuleAvailableAsync(parish, ct))
        };
    }

    public async Task<Page<MinistryMeetingDto>> ListAsync(string parish, string ministry, DateTimeOffset start, DateTimeOffset end,
        int size, string? cursor, CancellationToken ct)
    {
        var reader = await ReaderAsync(parish, ministry, ct);
        ScheduleRules.ValidatePeriod(start, end);
        var filters = new List<RecordCondition>
        {
            Equal("ministryId", ministry), new() { Path = "startsAt", Comparison = "lt", Value = end },
            new() { Path = "endsAt", Comparison = "gt", Value = start }
        };
        if (!reader.Privileged)
            filters.Add(new() { Path = "status", Comparison = "in", Value = new[] { "Confirmed", "Cancelled" } });
        var page = await records.PageAsync<MinistryMeeting>(MinistryAccess.Scope(parish), "ministryMeeting", size, cursor, ct, filters.ToArray());
        var available = reader.Group.Value.Status == "Active" && await ModuleAvailableAsync(parish, ct);
        var items = new List<MinistryMeetingDto>();
        foreach (var row in page.Items)
        {
            if (!Matches(row.Value, parish, ministry, row.Value.Id) || !Visible(row.Value, reader)) continue;
            await EventAsync(parish, row.Value, ct);
            items.Add(View(row.Value, reader.Privileged, available));
        }
        return new() { Items = items, ContinuationToken = page.ContinuationToken };
    }

    public async Task<MeetingRsvpDto> RsvpAsync(string parish, string ministry, string id, RsvpDto request, CancellationToken ct)
    {
        await access.PersonalAsync(ct);
        var root = await access.RootAsync(parish, ct);
        var group = await access.ReadAsync(parish, ministry, ct);
        var member = await MemberAsync(parish, ministry, ct);
        var meeting = await ReadAsync(parish, ministry, id, ct);
        RequireVisible(meeting.Value, new(group, false, member.Membership));
        var scope = MinistryAccess.Scope(parish);
        var key = RsvpKey(id, member.Link.Value.PersonId);
        var op = actor.CreateOperation(request.OperationId, request, clock, "ministry-meeting-rsvp:v1:" + ministry + ":" + id);
        if (await records.ReplayAsync<CommandResult>(scope, op, ct) is not null)
            return (await OwnRsvpAsync(parish, ministry, id, ct)).Value;
        await access.ModuleAsync(parish, ct);
        if (!RsvpOpen(meeting.Value)) throw State("This meeting is not accepting replies; a missing reply is not a refusal or recorded absence.");
        if (request.Response is not ("Yes" or "No" or "Undecided")) throw State("Choose Yes, No or Undecided.");
        var old = await records.ReadAsync<MeetingRsvp>(scope, key, ct);
        if (old is not null && (old.Value.AccountId != actor.AccountId || old.Value.MinistryId != ministry
            || old.Value.MeetingId != id || old.Value.PersonId != member.Link.Value.PersonId)) throw MinistryAccess.Missing();
        var person = await records.ReadAsync<Person>(scope, "person:" + member.Link.Value.PersonId, ct);
        var claim = await records.ReadAsync<CommandResult>(scope, "personAccountClaim:" + member.Link.Value.PersonId, ct);
        if (person?.Value is not { Archived: false } || person.Value.ParishId != parish
            || claim?.Value is not { Status: "Linked" } || claim.Value.Id != actor.AccountId) throw MinistryAccess.Missing();
        var value = new MeetingRsvp
        {
            Id = id + ":" + member.Link.Value.PersonId, MinistryId = ministry, MeetingId = id,
            PersonId = member.Link.Value.PersonId, AccountId = actor.AccountId, Response = request.Response, RespondedAt = op.At
        };
        await records.CommitAsync(scope, op, "ministry.meeting_rsvp", id,
            [MinistryAccess.Fence(root), GroupFence(group),
                RecordChange.Replace(Key(id), "ministryMeeting", meeting.Value, meeting.Version),
                RecordChange.Replace("personAccountLink:" + actor.AccountId, "personAccountLink", member.Link.Value, member.Link.Version),
                RecordChange.Replace("personAccountClaim:" + value.PersonId, "personAccountClaim", claim.Value, claim.Version),
                RecordChange.Replace("person:" + value.PersonId, "person", person.Value, person.Version),
                RecordChange.Replace(MinistryAccess.MemberKey(ministry, value.PersonId), "ministryMembership", member.Membership.Value, member.Membership.Version),
                old is null ? RecordChange.Create(key, "meetingRsvp", value) : RecordChange.Replace(key, "meetingRsvp", value, Versions.Require(request.Version))],
            new CommandResult { Id = id, Status = "Recorded" }, ct);
        return (await OwnRsvpAsync(parish, ministry, id, ct)).Value;
    }

    public async Task<Versioned<MeetingRsvpDto>> OwnRsvpAsync(string parish, string ministry, string id, CancellationToken ct)
    {
        var group = await access.ReadAsync(parish, ministry, ct);
        var member = await MemberAsync(parish, ministry, ct);
        var meeting = await ReadAsync(parish, ministry, id, ct);
        RequireVisible(meeting.Value, new(group, false, member.Membership));
        var row = await records.ReadAsync<MeetingRsvp>(MinistryAccess.Scope(parish), RsvpKey(id, member.Link.Value.PersonId), ct);
        if (row is not null && (row.Value.AccountId != actor.AccountId || row.Value.MinistryId != ministry
            || row.Value.PersonId != member.Link.Value.PersonId || row.Value.MeetingId != id)) throw MinistryAccess.Missing();
        return new()
        {
            Version = row?.Version ?? string.Empty,
            Value = RsvpView(meeting.Value, member.Link.Value.PersonId, row?.Value, RsvpOpen(meeting.Value) && await ModuleAvailableAsync(parish, ct))
        };
    }

    public async Task<Page<MeetingRsvpDto>> RsvpsAsync(string parish, string ministry, string id, int size, string? cursor, CancellationToken ct)
    {
        await access.LeaderAsync(parish, ministry, ct, requireModule: false);
        var meeting = await ReadAsync(parish, ministry, id, ct);
        var page = await records.PageAsync<MeetingRsvp>(MinistryAccess.Scope(parish), "meetingRsvp", size, cursor, ct,
            Equal("ministryId", ministry), Equal("meetingId", id));
        return new()
        {
            Items = page.Items.Select(row => RsvpView(meeting.Value, row.Value.PersonId, row.Value, false)).ToArray(),
            ContinuationToken = page.ContinuationToken
        };
    }

    public async Task<Page<MinistryMeetingHistoryDto>> HistoryAsync(string parish, string ministry, string id, int size, string? cursor, CancellationToken ct)
    {
        await access.LeaderAsync(parish, ministry, ct, requireModule: false);
        await ReadAsync(parish, ministry, id, ct);
        var page = await records.PageAsync<MinistryMeetingHistory>(MinistryAccess.Scope(parish), "ministryMeetingHistory", size, cursor, ct,
            Equal("ministryId", ministry), Equal("meetingId", id));
        return new()
        {
            Items = page.Items.Select(row => new MinistryMeetingHistoryDto
            {
                Id = row.Value.Id, MeetingId = row.Value.MeetingId, Action = row.Value.Action, Status = row.Value.Status,
                RecordedAt = row.Value.RecordedAt, Reason = row.Value.Reason
            }).ToArray(), ContinuationToken = page.ContinuationToken
        };
    }

    private async Task<Reader> ReaderAsync(string parish, string ministry, CancellationToken ct)
    {
        if (actor.ActingAppointmentId is not null)
            return new(await access.LeaderAsync(parish, ministry, ct, requireModule: false), true, null);
        try { return new(await access.LeaderAsync(parish, ministry, ct, requireModule: false), true, null); }
        catch (DomainException error) when (error.Kind is FailureKind.Forbidden or FailureKind.NotFound) { }
        var member = await MemberAsync(parish, ministry, ct);
        return new(await access.ReadAsync(parish, ministry, ct), false, member.Membership);
    }

    private async Task<(Versioned<PersonAccountLink> Link, Versioned<MinistryMembership> Membership)> MemberAsync(string parish, string ministry, CancellationToken ct)
    {
        var link = await access.OwnLinkAsync(parish, ct);
        var membership = await records.ReadAsync<MinistryMembership>(MinistryAccess.Scope(parish),
            MinistryAccess.MemberKey(ministry, link.Value.PersonId), ct);
        if (membership?.Value.Current(clock.GetUtcNow()) != true || membership.Value.MinistryId != ministry
            || membership.Value.PersonId != link.Value.PersonId) throw MinistryAccess.Missing();
        return (link, membership);
    }

    private bool Visible(MinistryMeeting meeting, Reader reader) => reader.Privileged
        || reader.Group.Value.Status == "Active" && meeting.Status is "Confirmed" or "Cancelled"
        && meeting.StartsAt > clock.GetUtcNow() && reader.Membership?.Value.Current(meeting.StartsAt) == true;

    private void RequireVisible(MinistryMeeting meeting, Reader reader)
    {
        if (!Visible(meeting, reader)) throw MinistryAccess.Missing();
    }

    private async Task<Versioned<MinistryMeeting>> ReadAsync(string parish, string ministry, string id, CancellationToken ct)
    {
        var row = await records.ReadAsync<MinistryMeeting>(MinistryAccess.Scope(parish), Key(id), ct) ?? throw MinistryAccess.Missing();
        if (!Matches(row.Value, parish, ministry, id)) throw MinistryAccess.Missing();
        await EventAsync(parish, row.Value, ct);
        return row;
    }

    private async Task<Versioned<CalendarEvent>> EventAsync(string parish, MinistryMeeting meeting, CancellationToken ct)
    {
        var row = await SchedulingScope.ReadEventAsync(records, parish, meeting.EventId, ct);
        var value = row.Value;
        if (value.ParishId != parish || value.Id != meeting.EventId || value.MinistryId != meeting.MinistryId
            || value.SourceType != "MinistryMeeting" || value.SourceId != meeting.Id || value.Kind != "MinistryMeeting"
            || value.Visibility != "Ministry" || value.Published || value.Status != meeting.Status
            || value.StartsAt != meeting.StartsAt || value.EndsAt != meeting.EndsAt || value.TimeZone != meeting.TimeZone
            || value.Title != meeting.Title || value.ClergyAccountIds?.Length > 0)
            throw State("The meeting/calendar ownership requires review before this operation.");
        return row;
    }

    private async Task RequireNoReservationsAsync(string parish, string occurrence, CancellationToken ct)
    {
        if ((await SchedulingScope.ReservationsAsync(records, parish, occurrence, ct)).Any(row => !SchedulingScope.IsEnded(row.Value)))
            throw State("End all linked reservations and wait for actual resource release before changing this occurrence.");
    }

    private MinistryMeeting Draft(string parish, string ministry, string id, SaveMinistryMeetingDto request, MinistryMeeting? old, Operation op)
    {
        ScheduleRules.ValidatePeriod(request.StartsAt, request.EndsAt);
        if (request.StartsAt <= op.At) throw State("Create a future meeting draft; historical attendance uses its reviewed workflow.");
        var zone = Guard.Text(request.TimeZone, "Time zone", 100);
        try { _ = TimeZoneInfo.FindSystemTimeZoneById(zone); }
        catch (Exception error) when (error is TimeZoneNotFoundException or InvalidTimeZoneException)
        { throw new DomainException("invalid_time_zone", "Use a recognized time-zone identifier."); }
        if (request.RsvpMode is not ("Optional" or "Required" or "NotRequested"))
            throw State("Choose Optional, Required or NotRequested RSVP.");
        DateTimeOffset? deadline = request.RsvpMode == "NotRequested" ? null : request.RsvpDeadline ?? request.StartsAt;
        if (request.RsvpMode == "NotRequested" && request.RsvpDeadline is not null)
            throw State("A meeting without RSVP cannot advertise a reply deadline.");
        if (deadline is { } cutoff && (Guard.Utc(cutoff) <= op.At || cutoff > request.StartsAt))
            throw State("Choose a future RSVP cutoff no later than the meeting start.");
        var policy = string.IsNullOrWhiteSpace(request.RsvpPolicyReference) ? null : Guard.Text(request.RsvpPolicyReference, "Actual RSVP policy", 1000);
        if (request.RsvpMode == "Required" && policy is null) throw State("Record the actual approved group policy before requiring RSVP.");
        return new()
        {
            Id = id, ParishId = parish, MinistryId = ministry, EventId = old?.EventId ?? id,
            Title = Guard.Text(request.Title, "Title", 500), StartsAt = request.StartsAt, EndsAt = request.EndsAt,
            TimeZone = zone, Visibility = "Ministry", Status = "Draft", Agenda = string.IsNullOrWhiteSpace(request.Agenda) ? string.Empty : Guard.Text(request.Agenda, "Agenda", 10000),
            LocationDescription = string.IsNullOrWhiteSpace(request.LocationDescription) ? null : Guard.Text(request.LocationDescription, "Location description", 1000),
            CreatedBy = old?.CreatedBy ?? actor.AccountId, CreatedAt = old?.CreatedAt ?? op.At,
            RsvpMode = request.RsvpMode, RsvpDeadline = deadline, RsvpPolicyReference = policy
        };
    }

    private static CalendarEvent Event(MinistryMeeting value) => new()
    {
        Id = value.EventId, ParishId = value.ParishId, MinistryId = value.MinistryId, SourceType = "MinistryMeeting", SourceId = value.Id,
        Kind = "MinistryMeeting", Title = value.Title, StartsAt = value.StartsAt, EndsAt = value.EndsAt, TimeZone = value.TimeZone,
        Visibility = "Ministry", Status = value.Status, CreatedBy = value.CreatedBy, Published = false, ClergyAccountIds = []
    };

    private async Task<MinistryMeetingDto> CurrentViewAsync(string parish, string ministry, string id, CancellationToken ct)
    {
        var group = await access.ReadAsync(parish, ministry, ct);
        var meeting = await ReadAsync(parish, ministry, id, ct);
        return View(meeting.Value, true, group.Value.Status == "Active" && await ModuleAvailableAsync(parish, ct));
    }

    private MinistryMeetingDto View(MinistryMeeting value, bool privileged, bool available) => new()
    {
        Id = value.Id, MinistryId = value.MinistryId, EventId = value.EventId, Title = value.Title, StartsAt = value.StartsAt,
        EndsAt = value.EndsAt, TimeZone = value.TimeZone, Visibility = value.Visibility, Agenda = value.Agenda,
        LocationDescription = value.LocationDescription, Status = value.Status, RsvpMode = value.RsvpMode,
        RsvpDeadline = value.RsvpDeadline, RsvpPolicyReference = privileged ? value.RsvpPolicyReference : null, RsvpOpen = RsvpOpen(value) && available
    };
    private bool RsvpOpen(MinistryMeeting value) => value.Status == "Confirmed" && value.RsvpMode is "Optional" or "Required"
        && value.StartsAt > clock.GetUtcNow() && value.RsvpDeadline is { } cutoff && cutoff > clock.GetUtcNow();
    private async Task<bool> ModuleAvailableAsync(string parish, CancellationToken ct)
    {
        try { await access.ModuleAsync(parish, ct); return true; }
        catch (DomainException error) when (error.Code == "subscription_required") { return false; }
    }
    private static MeetingRsvpDto RsvpView(MinistryMeeting meeting, string person, MeetingRsvp? value, bool canChange) => new()
    {
        MeetingId = meeting.Id, PersonId = person, Recorded = value is not null,
        Response = value?.Response, RespondedAt = value?.RespondedAt, CanChange = canChange
    };
    private static RecordChange History(MinistryMeeting value, string action, Operation op, string? reason) => RecordChange.Create(
        "ministryMeetingHistory:" + op.Id, "ministryMeetingHistory", new MinistryMeetingHistory
        {
            Id = op.Id, MinistryId = value.MinistryId, MeetingId = value.Id, Action = action, Status = value.Status,
            ActorId = op.ActorId, ActingAppointmentId = op.ActingAppointmentId, RecordedAt = op.At,
            Reason = string.IsNullOrWhiteSpace(reason) ? null : Guard.Text(reason, "Action reason", 2000)
        });
    private static bool Matches(MinistryMeeting value, string parish, string ministry, string id)
        => value.Id == id && value.ParishId == parish && value.MinistryId == ministry && value.Visibility == "Ministry";
    private static void RequireActive(Ministry value)
    {
        if (value.Status != "Active") throw State("Only an active approved ministry can start or confirm meeting work.");
    }
    private static string Key(string id) => "ministryMeeting:" + id;
    private static string RsvpKey(string meeting, string person) => "meetingRsvp:" + meeting + ":" + person;
    private static RecordCondition Equal(string field, string value) => new() { Path = field, Comparison = "eq", Value = value };
    private static RecordChange GroupFence(Versioned<Ministry> group) => RecordChange.Replace("ministry:" + group.Value.Id, "ministry", group.Value, group.Version);
    private static CommandResult Result(MinistryMeeting value) => new() { Id = value.Id, Status = value.Status };
    private static DomainException State(string message) => new("invalid_meeting_state", message, FailureKind.Conflict);
    private sealed record Reader(Versioned<Ministry> Group, bool Privileged, Versioned<MinistryMembership>? Membership);
}
