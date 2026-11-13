// Purpose: schedules and cancels dated maintenance blocks on rooms and spaces. A block takes the same room and exclusion-pair
// resource guards as a reservation through the allocator, so a block refuses a period a reservation already holds and a later
// reservation for the blocked period ends in Conflict through the existing allocation checks.
// Main functions: ScheduleAsync (records the block as Allocating, then holds and confirms each guard, and resumes on replay),
// ActAsync (cancel: records the decision, then releases every guard; a replay re-runs the idempotent releases), GetAsync and ListAsync.

using ParishLife.Api.DTOs.Scheduling;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Scheduling;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Scheduling;

public class MaintenanceService(IRecordTransactions records, IParishAccess access, ICurrentActor actor, IResourceAllocator allocator,
    FacilityService facilities, TimeProvider clock)
{
    private static string Key(string id) => "maintenanceBlock:" + id;
    private static DomainException State(string message) => new("invalid_maintenance_state", message, FailureKind.Conflict);

    private async Task<Versioned<Parish>> Authorize(string parish, string permission, CancellationToken ct)
    {
        var root = await access.RequireAsync(parish, permission, ct);
        await access.RequireModuleAsync(parish, "facilities", ct);
        return root;
    }

    public async Task<MaintenanceBlockDto> ScheduleAsync(string parish, MaintenanceDto request, CancellationToken ct)
    {
        var root = await Authorize(parish, Permissions.FacilitiesManage, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "maintenance");
        if (await records.ReplayAsync<MaintenanceBlock>(SchedulingScope.For(parish), op, ct) is { } prior)
        {
            var current = await ReadAsync(parish, prior.Id, ct);
            return View(current.Value.Status == "Allocating" ? await AllocateAsync(parish, current, ct) : current.Value);
        }
        ScheduleRules.ValidatePeriod(request.StartsAt, request.EndsAt);
        if (request.EndsAt <= op.At)
            throw new DomainException("invalid_period", "A maintenance block must end in the future.");
        var facility = Guard.Id(request.ResourceId);
        var specs = await facilities.BuildSpecsAsync(parish, [facility], request.StartsAt, request.EndsAt, ct, maintenance: true);
        var block = new MaintenanceBlock
        {
            Id = op.Id,
            ParishId = parish,
            FacilityId = facility,
            StartsAt = request.StartsAt,
            EndsAt = request.EndsAt,
            Reason = Guard.Text(request.Reason, "Reason", 2000),
            ReasonAr = Optional(request.ReasonAr, "Arabic reason", 2000),
            InCharge = Optional(request.InCharge, "In charge", 200),
            Status = "Allocating",
            Resources = specs,
            CreatedBy = actor.AccountId,
            CreatedAt = op.At
        };
        await records.CommitAsync(SchedulingScope.For(parish), op, "maintenance.schedule", facility,
            [SchedulingScope.Fence(root), RecordChange.Create(Key(block.Id), "maintenanceBlock", block)], block, ct);
        return View(await AllocateAsync(parish, await ReadAsync(parish, block.Id, ct), ct));
    }

    // Holds then confirms every guard. A refused guard releases all of them (tombstones fence a late hold), records Conflict and
    // reports the conflict; a temporary failure leaves the block Allocating, and replaying the same request resumes it.
    private async Task<MaintenanceBlock> AllocateAsync(string parish, Versioned<MaintenanceBlock> row, CancellationToken ct)
    {
        var block = row.Value;
        try
        {
            foreach (var spec in block.Resources)
                await allocator.HoldAsync(new AllocationRequest
                {
                    ResourceId = spec.ResourceId,
                    ParishId = parish,
                    BookingId = "maintenance:" + block.Id,
                    StartsAt = spec.StartsAt,
                    EndsAt = spec.EndsAt,
                    Quantity = spec.Quantity,
                    Capacity = spec.Capacity
                }, block.Id, clock.GetUtcNow().AddMinutes(5), ct);
            foreach (var spec in block.Resources)
                await allocator.ConfirmAsync(spec.ResourceId, block.Id, ct);
        }
        catch (DomainException error) when (error.Kind != FailureKind.Unavailable && error.Code != "write_conflict")
        {
            foreach (var spec in block.Resources)
                await allocator.ReleaseAsync(spec.ResourceId, block.Id, ct);
            block.Status = "Conflict";
            block.ErrorCode = error.Code;
            if (!await TrySaveAsync(parish, block, row.Version, ct))
                return (await ReadAsync(parish, block.Id, ct)).Value;
            throw new DomainException(error.Code == "resource_conflict" ? "maintenance_conflict" : error.Code,
                "The room is not free for the whole period: a reservation or another block holds it.", FailureKind.Conflict);
        }
        block.Status = "Active";
        if (!await TrySaveAsync(parish, block, row.Version, ct))
            return (await ReadAsync(parish, block.Id, ct)).Value;
        return block;
    }

    private async Task<bool> TrySaveAsync(string parish, MaintenanceBlock block, string version, CancellationToken ct)
    {
        try
        {
            await records.CommitAsync(SchedulingScope.For(parish), Operation.Create(Guid.NewGuid(), actor.AccountId, new { block.Id, block.Status }, clock),
                "maintenance." + block.Status.ToLowerInvariant(), block.FacilityId, [RecordChange.Replace(Key(block.Id), "maintenanceBlock", block, version)],
                new CommandResult { Id = block.Id, Status = block.Status }, ct);
            return true;
        }
        catch (DomainException error) when (error.Code == "write_conflict")
        {
            // A concurrent cancellation already decided the block; its state stands.
            return false;
        }
    }

    public async Task<MaintenanceBlockDto> ActAsync(string parish, string id, MaintenanceActionDto request, CancellationToken ct)
    {
        if (request.Action != "cancel")
            throw new DomainException("invalid_action", "Use cancel.");
        var root = await Authorize(parish, Permissions.FacilitiesManage, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "maintenance:" + id);
        if (await records.ReplayAsync<MaintenanceBlock>(SchedulingScope.For(parish), op, ct) is not null)
        {
            var decided = (await ReadAsync(parish, id, ct)).Value;
            await ReleaseAsync(decided, ct);
            return View(decided);
        }
        var row = await ReadAsync(parish, id, ct);
        var block = row.Value;
        if (block.Status is not ("Allocating" or "Active") || block.EndsAt <= op.At)
            throw State("Only a current or future maintenance block can be cancelled.");
        block.Status = "Cancelled";
        block.CancelledBy = actor.AccountId;
        block.CancelledAt = op.At;
        block.CancelReason = Guard.Text(request.Reason, "Cancellation reason", 2000);
        await records.CommitAsync(SchedulingScope.For(parish), op, "maintenance.cancel", block.FacilityId,
            [SchedulingScope.Fence(root), RecordChange.Replace(Key(id), "maintenanceBlock", block, Versions.Require(request.Version))], block, ct);
        await ReleaseAsync(block, ct);
        return View(block);
    }

    private async Task ReleaseAsync(MaintenanceBlock block, CancellationToken ct)
    {
        if (block.Status != "Cancelled")
            return;
        foreach (var spec in block.Resources)
            await allocator.ReleaseAsync(spec.ResourceId, block.Id, ct);
    }

    public async Task<Versioned<MaintenanceBlockDto>> GetAsync(string parish, string id, CancellationToken ct)
    {
        await Authorize(parish, Permissions.ScheduleRead, ct);
        var row = await ReadAsync(parish, id, ct);
        return new() { Value = View(row.Value), Version = row.Version };
    }

    public async Task<Page<Versioned<MaintenanceBlockDto>>> ListAsync(string parish, DateTimeOffset start, DateTimeOffset end, int size, string? cursor, CancellationToken ct)
    {
        await Authorize(parish, Permissions.ScheduleRead, ct);
        ScheduleRules.ValidatePeriod(start, end);
        var page = await records.PageAsync<MaintenanceBlock>(SchedulingScope.For(parish), "maintenanceBlock", size, cursor, ct,
            new RecordCondition { Path = "startsAt", Comparison = "lt", Value = end }, new RecordCondition { Path = "endsAt", Comparison = "gt", Value = start });
        return new() { Items = page.Items.Select(row => new Versioned<MaintenanceBlockDto> { Value = View(row.Value), Version = row.Version }).ToArray(), ContinuationToken = page.ContinuationToken };
    }

    private async Task<Versioned<MaintenanceBlock>> ReadAsync(string parish, string id, CancellationToken ct)
    {
        var row = await records.ReadAsync<MaintenanceBlock>(SchedulingScope.For(parish), Key(id), ct) ?? throw SchedulingScope.Missing();
        if (row.Value.Id != id || row.Value.ParishId != parish)
            throw SchedulingScope.Missing();
        return row;
    }

    private static string? Optional(string? value, string name, int max) => string.IsNullOrWhiteSpace(value) ? null : Guard.Text(value, name, max);

    private static MaintenanceBlockDto View(MaintenanceBlock value) => new()
    {
        Id = value.Id,
        FacilityId = value.FacilityId,
        StartsAt = value.StartsAt,
        EndsAt = value.EndsAt,
        Reason = value.Reason,
        ReasonAr = value.ReasonAr,
        InCharge = value.InCharge,
        Status = value.Status,
        ErrorCode = value.ErrorCode,
        CreatedBy = value.CreatedBy,
        CreatedAt = value.CreatedAt,
        CancelledBy = value.CancelledBy,
        CancelledAt = value.CancelledAt,
        CancelReason = value.CancelReason
    };
}
