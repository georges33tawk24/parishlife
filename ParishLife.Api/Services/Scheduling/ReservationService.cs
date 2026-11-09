// Purpose: accepts exact event-linked room requests and queues auditable allocation/cancellation work without fabricating confirmation.
// Main functions: RequestAsync, ActAsync, GetAsync, ListAsync; helpers validate manual or exact meeting sources and return current safe state on replay.

using ParishLife.Api.DTOs.Scheduling;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Scheduling;

public class ReservationService(IRecordTransactions records, IParishAccess access, ICurrentActor actor, FacilityService facilities,
    ReservationWorkAuthorization authorization, ReservationMeetingAccess meetingAccess, TimeProvider clock)
{
    private async Task<Versioned<Parish>> Authorize(string parish, bool allocation, CancellationToken ct)
    {
        var root = await access.RequireAsync(parish, Permissions.FacilitiesManage, ct);
        if (allocation)
            await access.RequireModuleAsync(parish, "facilities", ct);
        return root;
    }
    public async Task<ReservationDto> RequestAsync(string parish, ReserveDto request, CancellationToken ct)
    {
        var root = await Authorize(parish, true, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "reservation");
        if (await records.ReplayAsync<Reservation>(SchedulingScope.For(parish), op, ct) is { } prior)
            return await View(parish, (await Read(parish, prior.Id, ct)).Value, ct);
        ScheduleRules.ValidatePeriod(request.StartsAt, request.EndsAt);
        var occurrence = await SchedulingScope.ReadEventAsync(records, parish, Guard.Id(request.EventId), ct);
        await meetingAccess.RequireAsync(parish, occurrence.Value, true, ct);
        if (occurrence.Value.Status != "Draft" || request.StartsAt != occurrence.Value.StartsAt || request.EndsAt != occurrence.Value.EndsAt || request.StartsAt <= clock.GetUtcNow())
            throw new DomainException("reservation_event_mismatch", "Reserve the exact future period of an authorized draft occurrence.", FailureKind.Conflict);
        var selected = new[] { Guard.Id(request.ResourceId) }.Concat(request.AdditionalResourceIds?.Select(Guard.Id) ?? []).Distinct(StringComparer.Ordinal).Order(StringComparer.Ordinal).ToArray();
        if (selected.Length > 25)
            throw new DomainException("allocation_limit", "Select at most 25 facilities.");
        _ = await facilities.BuildSpecsAsync(parish, selected, request.StartsAt, request.EndsAt, ct);
        var customer = request.CustomerId is null ? null : Guard.Id(request.CustomerId.Value);
        if (customer is not null && (await records.ReadAsync<Person>(SchedulingScope.For(parish), "person:" + customer, ct))?.Value is not { Archived: false })
            throw new DomainException("customer_unavailable", "The linked person must exist in this parish.");
        var value = new Reservation
        {
            Id = op.Id,
            ParishId = parish,
            ResourceId = Guard.Id(request.ResourceId),
            EventId = occurrence.Value.Id,
            RequestedBy = actor.AccountId,
            StartsAt = request.StartsAt,
            EndsAt = request.EndsAt,
            Status = "Requested",
            AllocationResourceIds = selected,
            CustomerId = customer,
            TermsSnapshot = string.IsNullOrWhiteSpace(request.TermsSnapshot) ? null : Guard.Text(request.TermsSnapshot, "Actual terms snapshot", 10000)
        };
        await records.CommitAsync(SchedulingScope.For(parish), op, "reservation.request", value.Id,
            [SchedulingScope.Fence(root), RecordChange.Create("reservation:" + value.Id, "reservation", value)], value, ct);
        return await View(parish, value, ct);
    }
    public async Task<ReservationDto> ActAsync(string parish, string id, ReservationActionDto request, CancellationToken ct)
    {
        if (request.Action is not ("confirm" or "cancel" or "decline") || request.HoldUntil is not null)
            throw new DomainException("invalid_action", "Use confirm, decline or cancel; temporary holds are managed by the allocation worker.");
        var root = await Authorize(parish, request.Action == "confirm", ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "reservation:" + id);
        if (await records.ReplayAsync<Reservation>(SchedulingScope.For(parish), op, ct) is not null)
            return await View(parish, (await Read(parish, id, ct)).Value, ct);
        var row = await Read(parish, id, ct);
        var value = row.Value;
        var occurrence = await SchedulingScope.ReadEventAsync(records, parish, value.EventId, ct);
        await meetingAccess.RequireAsync(parish, occurrence.Value, request.Action == "confirm", ct);
        var reason = Guard.Text(request.Reason, "Decision reason", 2000);
        var changes = new List<RecordChange> { SchedulingScope.Fence(root) };
        if (request.Action == "confirm")
        {
            if (value.Status is not ("Requested" or "Conflict") || occurrence.Value.Status != "Draft" || value.StartsAt <= clock.GetUtcNow())
                throw State();
            var specs = await facilities.BuildSpecsAsync(parish, value.AllocationResourceIds, value.StartsAt, value.EndsAt, ct);
            var work = new ReservationWork
            {
                Id = op.Id,
                ParishId = parish,
                ReservationId = id,
                ActorId = actor.AccountId,
                MinistryId = occurrence.Value.SourceType == "MinistryMeeting" ? occurrence.Value.MinistryId : null,
                MeetingId = occurrence.Value.SourceType == "MinistryMeeting" ? occurrence.Value.SourceId : null,
                ActingAppointmentId = actor.ActingAppointmentId,
                ActorSecurityStamp = await authorization.CaptureStampAsync(actor.AccountId, ct),
                Fingerprint = op.Fingerprint,
                Status = "Allocating",
                Resources = specs
            };
            value.Status = "Allocating";
            value.CurrentWorkId = work.Id;
            changes.Add(RecordChange.Create("reservationWork:" + work.Id, "reservationWork", work));
        }
        else
        {
            if (SchedulingScope.IsEnded(value) || request.Action == "decline" && value.Status != "Requested")
                throw State();
            if (value.CurrentWorkId is null)
                value.Status = request.Action == "decline" ? "Declined" : "Cancelled";
            else
            {
                if (value.StartsAt <= clock.GetUtcNow() && value.Status == "Confirmed")
                    throw new DomainException("historical_reservation", "Use a reviewed historical correction for a completed confirmed reservation.", FailureKind.Conflict);
                var work = await records.ReadAsync<ReservationWork>(SchedulingScope.For(parish), "reservationWork:" + value.CurrentWorkId, ct) ?? throw SchedulingScope.Missing();
                work.Value.Status = "Cancelling";
                work.Value.LeaseOwner = null;
                work.Value.LeaseUntil = null;
                changes.Add(RecordChange.Replace("reservationWork:" + work.Value.Id, "reservationWork", work.Value, work.Version));
                value.Status = "Cancelling";
            }
        }
        value.LastActionReason = reason;
        changes.Add(RecordChange.Replace("reservation:" + id, "reservation", value, Versions.Require(request.Version)));
        await records.CommitAsync(SchedulingScope.For(parish), op, "reservation." + request.Action, id, changes, value, ct);
        return await View(parish, value, ct);
    }
    public async Task<Versioned<ReservationDto>> GetAsync(string parish, string id, CancellationToken ct)
    {
        await Authorize(parish, false, ct);
        var row = await Read(parish, id, ct);
        var value = await View(parish, row.Value, ct);
        return new() { Value = value, Version = value.Redacted ? string.Empty : row.Version };
    }
    public async Task<Page<Versioned<ReservationDto>>> ListAsync(string parish, DateTimeOffset start, DateTimeOffset end, int size, string? cursor, CancellationToken ct)
    {
        await Authorize(parish, false, ct);
        ScheduleRules.ValidatePeriod(start, end);
        var page = await records.PageAsync<Reservation>(SchedulingScope.For(parish), "reservation", size, cursor, ct,
            new RecordCondition { Path = "startsAt", Comparison = "lt", Value = end }, new RecordCondition { Path = "endsAt", Comparison = "gt", Value = start });
        var items = new List<Versioned<ReservationDto>>();
        foreach (var row in page.Items)
        { var value = await View(parish, row.Value, ct); items.Add(new() { Value = value, Version = value.Redacted ? string.Empty : row.Version }); }
        return new() { Items = items, ContinuationToken = page.ContinuationToken };
    }
    private async Task<Versioned<Reservation>> Read(string parish, string id, CancellationToken ct)
        => await records.ReadAsync<Reservation>(SchedulingScope.For(parish), "reservation:" + id, ct) ?? throw SchedulingScope.Missing();
    private async Task<ReservationDto> View(string parish, Reservation value, CancellationToken ct)
    {
        var occurrence = (await SchedulingScope.ReadEventAsync(records, parish, value.EventId, ct)).Value;
        var hidden = occurrence.Visibility == "Private" && occurrence.CreatedBy != actor.AccountId
            || occurrence.Visibility == "Ministry" && !await meetingAccess.CanReadAsync(parish, occurrence, ct);
        var work = value.CurrentWorkId is null ? null : await records.ReadAsync<ReservationWork>(SchedulingScope.For(parish), "reservationWork:" + value.CurrentWorkId, ct);
        return new()
        {
            Id = value.Id,
            ParishId = parish,
            ResourceId = value.ResourceId,
            EventId = hidden ? null : value.EventId,
            RequestedBy = hidden ? null : value.RequestedBy,
            StartsAt = value.StartsAt,
            EndsAt = value.EndsAt,
            Status = value.Status,
            AllocationResourceIds = [.. value.AllocationResourceIds],
            Redacted = hidden,
            CustomerId = hidden ? null : value.CustomerId,
            TermsSnapshot = hidden ? null : value.TermsSnapshot,
            CurrentWorkId = hidden ? null : value.CurrentWorkId,
            ErrorCode = hidden ? null : work?.Value.ErrorCode,
            LastActionReason = hidden ? null : value.LastActionReason
        };
    }
    private static DomainException State() => new("invalid_reservation_state", "This action is unavailable in the current reservation state.", FailureKind.Conflict);
}
