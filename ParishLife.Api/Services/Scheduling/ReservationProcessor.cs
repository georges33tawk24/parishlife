// Purpose: resumes leased reservation allocation and compensation across exact resource partitions, publishing success only after all holds confirm.
// Main functions: ProcessPageAsync bounds a worker pass; ProcessOneAsync, CheckAsync, SaveAsync and FinishAsync enforce ownership, live authority, cancellation fencing and recoverable failure.

using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Repositories.Scheduling;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Scheduling;

public class ReservationProcessor(IRecordTransactions records, IResourceAllocator allocator, IParishRepository parishes,
    ReservationWorkAuthorization authorization, TimeProvider clock)
{
    public async Task<string?> ProcessPageAsync(string worker, string? cursor, CancellationToken ct)
    {
        var page = await records.ScanWorkAsync<ReservationWork>(RecordArea.Parish, "reservationWork", 25, cursor, ct);
        foreach (var row in page.Items)
        {
            try
            { await ProcessOneAsync(row.Value.ParishId, row.Value.Id, worker, ct); }
            catch (DomainException error) when (error.Kind is FailureKind.Conflict or FailureKind.Unavailable) { /* Durable work remains retryable. */ }
        }
        return page.ContinuationToken;
    }
    public async Task ProcessOneAsync(string parish, string id, string worker, CancellationToken ct)
    {
        var scope = SchedulingScope.For(parish);
        var row = await records.ReadAsync<ReservationWork>(scope, "reservationWork:" + id, ct);
        if (row is null || row.Value.Status is not ("Allocating" or "Cancelling" or "Compensating"))
            return;
        if (row.Value.LeaseUntil > clock.GetUtcNow() && row.Value.LeaseOwner != worker)
            return;
        var work = row.Value;
        work.LeaseOwner = worker;
        work.LeaseUntil = clock.GetUtcNow().AddMinutes(2);
        await SaveAsync(scope, work, row.Version, "lease", ct);
        try
        {
            if (work.Status == "Allocating")
            {
                await authorization.RequireAsync(work, ct);
                foreach (var spec in work.Resources)
                {
                    await CheckAsync(scope, id, worker, "Allocating", ct);
                    await authorization.RequireAsync(work, ct);
                    await allocator.HoldAsync(new AllocationRequest
                    {
                        ResourceId = spec.ResourceId,
                        ParishId = parish,
                        BookingId = work.ReservationId,
                        StartsAt = spec.StartsAt,
                        EndsAt = spec.EndsAt,
                        Quantity = spec.Quantity,
                        Capacity = spec.Capacity
                    }, id, clock.GetUtcNow().AddMinutes(5), ct);
                }
                foreach (var spec in work.Resources)
                {
                    await CheckAsync(scope, id, worker, "Allocating", ct);
                    await authorization.RequireAsync(work, ct);
                    await allocator.ConfirmAsync(spec.ResourceId, id, ct);
                }
                await FinishAsync(scope, work, "Confirmed", "Completed", ct);
                return;
            }
        }
        catch (DomainException error) when (error.Kind != FailureKind.Unavailable && error.Code != "write_conflict")
        {
            var latest = await records.ReadAsync<ReservationWork>(scope, "reservationWork:" + id, ct) ?? throw new InvalidOperationException("Reservation work disappeared.");
            if (latest.Value.Status != "Allocating" || latest.Value.LeaseOwner != worker || latest.Value.LeaseUntil <= clock.GetUtcNow())
                return;
            work = latest.Value;
            work.Status = "Compensating";
            work.ErrorCode = error.Code;
            await SaveAsync(scope, work, latest.Version, "compensating", ct);
        }
        if (work.Status is "Compensating" or "Cancelling")
        {
            foreach (var spec in work.Resources)
            {
                await CheckAsync(scope, id, worker, work.Status, ct);
                await allocator.ReleaseAsync(spec.ResourceId, id, ct);
            }
            await FinishAsync(scope, work, work.Status == "Cancelling" ? "Cancelled" : "Conflict", "Ended", ct);
        }
    }
    private async Task<Versioned<ReservationWork>> CheckAsync(RecordScope scope, string id, string worker, string state, CancellationToken ct)
    {
        var row = await records.ReadAsync<ReservationWork>(scope, "reservationWork:" + id, ct);
        if (row is null || row.Value.Status != state || row.Value.LeaseOwner != worker || row.Value.LeaseUntil <= clock.GetUtcNow())
            throw new DomainException("allocation_superseded", "This allocation lease or state was superseded.", FailureKind.Conflict);
        return row;
    }
    private Task<ReservationWork> SaveAsync(RecordScope scope, ReservationWork work, string version, string phase, CancellationToken ct)
        => records.CommitAsync(scope, Operation.Create(Guid.NewGuid(), "system:reservations", new { work.Id, phase, version }, clock), "reservation." + phase,
            work.ReservationId, [RecordChange.Replace("reservationWork:" + work.Id, "reservationWork", work, version)], work, ct);
    private async Task FinishAsync(RecordScope scope, ReservationWork work, string status, string workStatus, CancellationToken ct)
    {
        var latest = await CheckAsync(scope, work.Id, work.LeaseOwner!, work.Status, ct);
        var root = status == "Confirmed" ? await authorization.RequireAsync(latest.Value, ct)
            : await parishes.GetAsync(work.ParishId, ct) ?? throw SchedulingScope.Missing();
        var row = await records.ReadAsync<Reservation>(scope, "reservation:" + work.ReservationId, ct) ?? throw SchedulingScope.Missing();
        if (row.Value.CurrentWorkId != work.Id || status == "Confirmed" && row.Value.Status != "Allocating")
            throw new DomainException("allocation_superseded", "This attempt no longer owns the reservation.", FailureKind.Conflict);
        if (status == "Confirmed")
        {
            var occurrence = await SchedulingScope.ReadEventAsync(records, work.ParishId, row.Value.EventId, ct);
            if (occurrence.Value.Status != "Draft" || row.Value.StartsAt <= clock.GetUtcNow())
                throw new DomainException("event_changed", "The occurrence or reservation period is no longer allocatable.", FailureKind.Conflict);
        }
        latest.Value.Status = workStatus;
        latest.Value.LeaseOwner = null;
        latest.Value.LeaseUntil = null;
        row.Value.Status = status;
        await records.CommitAsync(scope, Operation.Create(Guid.NewGuid(), "system:reservations", new { work.Id, status }, clock), "reservation." + status.ToLowerInvariant(), work.ReservationId,
            [SchedulingScope.Fence(root), RecordChange.Replace("reservationWork:" + work.Id, "reservationWork", latest.Value, latest.Version),
             RecordChange.Replace("reservation:" + work.ReservationId, "reservation", row.Value, row.Version)], new CommandResult { Id = work.ReservationId, Status = status }, ct);
    }
}
