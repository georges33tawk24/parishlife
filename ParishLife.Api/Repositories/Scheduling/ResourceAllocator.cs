// Purpose: Uses resource guard records to prevent concurrent over-allocation and to fence cancelled/expired holds.
// Main functions: Scope, GuardAsync, HoldAsync, ConfirmAsync, ReleaseAsync, BusyAsync.

using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Scheduling;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Repositories.Scheduling;

internal sealed class ResourceAllocator(IRecordTransactions records, TimeProvider clock) : IResourceAllocator
{
    private static RecordScope Scope(string resource) => new RecordScope
    {
        Area = RecordArea.Resource,
        OwnerId = resource
    };
    private async Task<Versioned<ResourceGuard>> GuardAsync(string id, CancellationToken ct)
    {
        var scope = Scope(id);
        var current = await records.ReadAsync<ResourceGuard>(scope, "guard", ct);
        if (current is not null)
            return current;
        var op = Operation.Create(Guid.NewGuid(), "system:allocator", new { CreateGuard = id }, clock);
        try
        {
            await records.CommitAsync(scope, op, "resource.initialize", id, [RecordChange.Create("guard", "resourceGuard", new ResourceGuard { Id = "guard", ResourceId = id })], new CommandResult { Id = id, Status = "Ready" }, ct);
        }
        catch (DomainException ex) when (ex.Code == "write_conflict")
        {
        }

        return await records.ReadAsync<ResourceGuard>(scope, "guard", ct) ?? throw new DomainException("allocation_unavailable", "Resource guard could not be initialized.", FailureKind.Unavailable);
    }

    public async Task HoldAsync(AllocationRequest request, string operationId, DateTimeOffset expiresAt, CancellationToken ct)
    {
        Guard.Utc(request.StartsAt);
        Guard.Utc(request.EndsAt);
        if (request.EndsAt <= request.StartsAt || request.EndsAt - request.StartsAt > TimeSpan.FromDays(33) || Guard.Utc(expiresAt) <= clock.GetUtcNow())
            throw new DomainException("invalid_period", "Use a valid bounded resource interval and a future hold expiry.");
        var scope = Scope(request.ResourceId);
        var op = Operation.Create(Guid.Parse(operationId), "system:allocator", request, clock, request.ResourceId);
        var existing = await records.ReadAsync<ResourceAllocation>(scope, "allocation:" + operationId, ct);
        if (existing?.Value.Status == "Released")
            throw new DomainException("allocation_cancelled", "This allocation attempt has ended.", FailureKind.Conflict);
        if (await records.ReplayAsync<ResourceAllocation>(scope, op, ct) is not null)
        {
            if (existing?.Value.Status == "Confirmed" || existing?.Value.ExpiresAt > clock.GetUtcNow())
                return;
            throw new DomainException("hold_expired", "Recheck availability with a new reservation attempt.", FailureKind.Conflict);
        }

        var guard = await GuardAsync(request.ResourceId, ct);
        var current = await records.CollectAsync<ResourceAllocation>(scope, "allocation", ct, 5000,
            new RecordCondition { Path = "startsAt", Comparison = "lt", Value = request.EndsAt },
            new RecordCondition { Path = "endsAt", Comparison = "gt", Value = request.StartsAt });
        var active = current.Select(x => x.Value).Where(x => x.OperationId != operationId && x.Status is "Held" or "Confirmed" && (x.Status == "Confirmed" || x.ExpiresAt > clock.GetUtcNow()) && ScheduleRules.Overlaps(request.StartsAt, request.EndsAt, x.StartsAt, x.EndsAt)).ToArray();
        if (request.Quantity <= 0 || request.Quantity > request.Capacity)
            throw new DomainException("invalid_quantity", "The allocation quantity exceeds capacity.");
        var points = active.SelectMany(a => new[] { a.StartsAt, a.EndsAt }).Append(request.StartsAt).Where(p => p >= request.StartsAt && p < request.EndsAt).Distinct();
        if (points.Any(p => active.Where(a => a.StartsAt <= p && p < a.EndsAt).Sum(a => (long)a.Quantity) + request.Quantity > request.Capacity))
            throw new DomainException("resource_conflict", "The resource is not available for the full requested period.", FailureKind.Conflict);
        var allocation = new ResourceAllocation
        {
            Id = operationId,
            OperationId = operationId,
            ParishId = request.ParishId,
            ResourceId = request.ResourceId,
            StartsAt = request.StartsAt,
            EndsAt = request.EndsAt,
            Quantity = request.Quantity,
            Capacity = request.Capacity,
            Status = "Held",
            ExpiresAt = expiresAt,
            BookingId = request.BookingId
        };
        var old = await records.ReadAsync<ResourceAllocation>(scope, "allocation:" + operationId, ct);
        var changes = new List<RecordChange>
        {
            RecordChange.Replace("guard", "resourceGuard", guard.Value, guard.Version)
        };
        changes.Add(old is null ? RecordChange.Create("allocation:" + operationId, "allocation", allocation) : RecordChange.Replace("allocation:" + operationId, "allocation", allocation, old.Version));
        await records.CommitAsync(scope, op, "resource.hold", operationId, changes, allocation, ct);
    }

    public async Task ConfirmAsync(string resourceId, string operationId, CancellationToken ct)
    {
        var scope = Scope(resourceId);
        var guard = await GuardAsync(resourceId, ct);
        var row = await records.ReadAsync<ResourceAllocation>(scope, "allocation:" + operationId, ct) ?? throw new DomainException("hold_missing", "A required resource hold is missing.", FailureKind.Conflict);
        if (row.Value.Status == "Confirmed")
            return;
        // A held allocation is frozen by confirmation before the coordinator may
        // publish success. Expired holds never silently become confirmed.
        if (row.Value.Status != "Held" || row.Value.ExpiresAt <= clock.GetUtcNow())
            throw new DomainException("hold_expired", "Recheck availability before confirming.", FailureKind.Conflict);
        var op = Operation.Create(Guid.NewGuid(), "system:allocator", new { Confirm = operationId, resourceId }, clock);
        await records.CommitAsync(scope, op, "resource.confirm", operationId, [RecordChange.Replace("guard", "resourceGuard", guard.Value, guard.Version), RecordChange.Replace("allocation:" + operationId, "allocation", new ResourceAllocation { Id = row.Value.Id, OperationId = row.Value.OperationId, ParishId = row.Value.ParishId, ResourceId = row.Value.ResourceId, StartsAt = row.Value.StartsAt, EndsAt = row.Value.EndsAt, Quantity = row.Value.Quantity, Capacity = row.Value.Capacity, Status = "Confirmed", ExpiresAt = null, BookingId = row.Value.BookingId }, row.Version)], new CommandResult { Id = operationId, Status = "Confirmed" }, ct);
    }

    public async Task ReleaseAsync(string resourceId, string operationId, CancellationToken ct)
    {
        var scope = Scope(resourceId);
        var guard = await GuardAsync(resourceId, ct);
        var row = await records.ReadAsync<ResourceAllocation>(scope, "allocation:" + operationId, ct);
        if (row?.Value.Status == "Released")
            return;
        var op = Operation.Create(Guid.NewGuid(), "system:allocator", new { Release = operationId, resourceId }, clock);
        // A durable tombstone fences a delayed coordinator that has not created
        // its hold yet. It may never resurrect an allocation after cancellation.
        var released = row is not null ? new ResourceAllocation
        {
            Id = row.Value.Id,
            OperationId = row.Value.OperationId,
            ParishId = row.Value.ParishId,
            ResourceId = row.Value.ResourceId,
            StartsAt = row.Value.StartsAt,
            EndsAt = row.Value.EndsAt,
            Quantity = row.Value.Quantity,
            Capacity = row.Value.Capacity,
            Status = "Released",
            ExpiresAt = row.Value.ExpiresAt,
            BookingId = row.Value.BookingId
        }

        : new ResourceAllocation
        {
            Id = operationId,
            OperationId = operationId,
            ParishId = "",
            ResourceId = resourceId,
            StartsAt = DateTimeOffset.UnixEpoch,
            EndsAt = DateTimeOffset.UnixEpoch,
            Quantity = 0,
            Capacity = 0,
            Status = "Released",
            ExpiresAt = null,
            BookingId = ""
        };
        await records.CommitAsync(scope, op, "resource.release", operationId, [RecordChange.Replace("guard", "resourceGuard", guard.Value, guard.Version), row is null ? RecordChange.Create("allocation:" + operationId, "allocation", released) : RecordChange.Replace("allocation:" + operationId, "allocation", released, row.Version)], new CommandResult { Id = operationId, Status = "Released" }, ct);
    }

    public async Task<IReadOnlyList<ResourceAllocation>> BusyAsync(string resourceId, DateTimeOffset start, DateTimeOffset end, CancellationToken ct)
        => (await records.CollectAsync<ResourceAllocation>(Scope(resourceId), "allocation", ct, 5000,
            new RecordCondition { Path = "startsAt", Comparison = "lt", Value = end },
            new RecordCondition { Path = "endsAt", Comparison = "gt", Value = start })).Select(x => x.Value)
            .Where(x => x.Status is "Held" or "Confirmed" && (x.Status == "Confirmed" || x.ExpiresAt > clock.GetUtcNow())).ToArray();
}
