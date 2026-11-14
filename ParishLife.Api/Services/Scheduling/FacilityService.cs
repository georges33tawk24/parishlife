// Purpose: manages parish rooms/spaces, dependency-safe configuration and privacy-safe busy intervals using actual resource allocations.
// Main functions: SaveAsync, SetStatusAsync, GetAsync, ListAsync, AvailabilityAsync and BuildSpecsAsync; pairwise exclusion keys avoid overblocking independent rooms.
// Rooms carry optional Arabic name and description twins; BuildSpecsAsync also builds the exact-period guards a maintenance block holds.

using ParishLife.Api.DTOs.Scheduling;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Scheduling;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Scheduling;

public class FacilityService(IRecordTransactions records, IParishAccess access, ICurrentActor actor, IResourceAllocator allocator, TimeProvider clock)
{
    private async Task<Versioned<Parish>> Authorize(string parish, string permission, CancellationToken ct)
    {
        var row = await access.RequireAsync(parish, permission, ct);
        await access.RequireModuleAsync(parish, "facilities", ct);
        return row;
    }
    public async Task<FacilityDto> SaveAsync(string parish, string? id, SaveFacilityDto request, CancellationToken ct)
    {
        var root = await Authorize(parish, Permissions.FacilitiesManage, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "facility:" + id);
        if (await records.ReplayAsync<Facility>(SchedulingScope.For(parish), op, ct) is { } prior)
            return View((await ReadAsync(parish, prior.Id, ct)).Value);
        if (request.Kind is not ("Room" or "Space") || request.Capacity < 1 || request.SetupMinutes is < 0 or > 1440 || request.CleanupMinutes is < 0 or > 1440
            || request.ExclusionResourceIds is null || request.ExclusionResourceIds.Length > 20)
            throw new DomainException("invalid_facility", "Use a room/space, positive occupant capacity and bounded setup, cleanup and exclusion values.");
        var exclusions = request.ExclusionResourceIds.Select(Guard.Id).Order(StringComparer.Ordinal).ToArray();
        var target = id ?? op.Id;
        if (exclusions.Contains(target) || exclusions.Distinct(StringComparer.Ordinal).Count() != exclusions.Length)
            throw new DomainException("invalid_exclusions", "Use distinct other facilities from this parish.");
        foreach (var excluded in exclusions)
            _ = await ReadAsync(parish, excluded, ct);
        var old = id is null ? null : await ReadAsync(parish, id, ct);
        var structural = old is null || old.Value.SetupMinutes != request.SetupMinutes || old.Value.CleanupMinutes != request.CleanupMinutes
            || old.Value.Capacity != request.Capacity || !old.Value.ExclusionResourceIds.Order(StringComparer.Ordinal).SequenceEqual(exclusions);
        if (structural)
        {
            var affected = exclusions.Concat(old?.Value.ExclusionResourceIds ?? []).Append(target).ToHashSet(StringComparer.Ordinal);
            await RequireNoFutureBookings(parish, affected, ct);
            // A maintenance block holds the exclusion-pair guards of its room, so the pairs cannot change under it.
            if (old is not null && !old.Value.ExclusionResourceIds.Order(StringComparer.Ordinal).SequenceEqual(exclusions))
                await RequireNoActiveMaintenance(parish, affected, ct);
        }
        var value = new Facility
        {
            Id = target,
            ParishId = parish,
            Name = Guard.Text(request.Name, "Name", 500),
            NameAr = string.IsNullOrWhiteSpace(request.NameAr) ? null : Guard.Text(request.NameAr, "Arabic name", 500),
            PublicDescriptionAr = string.IsNullOrWhiteSpace(request.PublicDescriptionAr) ? null : Guard.Text(request.PublicDescriptionAr, "Arabic description", 500),
            Kind = request.Kind,
            Capacity = request.Capacity,
            SetupMinutes = request.SetupMinutes,
            CleanupMinutes = request.CleanupMinutes,
            ExclusionResourceIds = exclusions,
            Status = old?.Value.Status ?? "Serviceable",
            PublicDescription = string.IsNullOrWhiteSpace(request.PublicDescription) ? null : Guard.Text(request.PublicDescription, "Description", 500)
        };
        await records.CommitAsync(SchedulingScope.For(parish), op, "facility.save", target, [SchedulingScope.Fence(root), old is null
            ? RecordChange.Create("facility:" + target, "facility", value) : RecordChange.Replace("facility:" + target, "facility", value, Versions.Require(request.Version))], value, ct);
        return View(value);
    }
    public async Task<FacilityDto> SetStatusAsync(string parish, string id, FacilityStatusDto request, CancellationToken ct)
    {
        var root = await Authorize(parish, Permissions.FacilitiesManage, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "facility-status:" + id);
        if (await records.ReplayAsync<Facility>(SchedulingScope.For(parish), op, ct) is not null)
            return View((await ReadAsync(parish, id, ct)).Value);
        if (request.Status is not ("Serviceable" or "OutOfService"))
            throw new DomainException("invalid_status", "Choose Serviceable or OutOfService.");
        var row = await ReadAsync(parish, id, ct);
        if (request.Status == "OutOfService")
            await RequireNoFutureBookings(parish, new HashSet<string>([id], StringComparer.Ordinal), ct);
        var reason = Guard.Text(request.Reason, "Serviceability reason", 2000);
        row.Value.Status = request.Status;
        await records.CommitAsync(SchedulingScope.For(parish), op, "facility.status", id,
            [SchedulingScope.Fence(root), RecordChange.Replace("facility:" + id, "facility", row.Value, Versions.Require(request.Version))], row.Value, ct, reason);
        return View(row.Value);
    }
    public async Task<Versioned<FacilityDto>> GetAsync(string parish, string id, CancellationToken ct)
    {
        await Authorize(parish, Permissions.ScheduleRead, ct);
        var row = await ReadAsync(parish, id, ct);
        return new() { Value = View(row.Value), Version = row.Version };
    }
    public async Task<Page<Versioned<FacilityDto>>> ListAsync(string parish, int size, string? cursor, CancellationToken ct)
    {
        await Authorize(parish, Permissions.ScheduleRead, ct);
        var page = await records.PageAsync<Facility>(SchedulingScope.For(parish), "facility", size, cursor, ct);
        return new() { Items = page.Items.Select(row => new Versioned<FacilityDto> { Value = View(row.Value), Version = row.Version }).ToArray(), ContinuationToken = page.ContinuationToken };
    }
    public async Task<IReadOnlyList<AvailabilitySlotDto>> AvailabilityAsync(string parish, string id, DateTimeOffset start, DateTimeOffset end, CancellationToken ct)
    {
        await Authorize(parish, Permissions.ScheduleRead, ct);
        ScheduleRules.ValidatePeriod(start, end);
        var row = await ReadAsync(parish, id, ct);
        if (row.Value.Status != "Serviceable")
            return [new() { StartsAt = start, EndsAt = end, Status = "Unavailable" }];
        var specs = await BuildSpecsAsync(parish, [id], start, end, ct);
        var intervals = new List<ResourceAllocation>();
        foreach (var spec in specs)
            intervals.AddRange(await allocator.BusyAsync(spec.ResourceId, start, end, ct));
        var merged = new List<AvailabilitySlotDto>();
        foreach (var value in intervals.OrderBy(item => item.StartsAt))
        {
            var a = value.StartsAt < start ? start : value.StartsAt;
            var b = value.EndsAt > end ? end : value.EndsAt;
            if (merged.LastOrDefault() is { } last && a <= last.EndsAt)
                last.EndsAt = b > last.EndsAt ? b : last.EndsAt;
            else
                merged.Add(new() { StartsAt = a, EndsAt = b, Status = "Busy" });
        }
        return merged;
    }
    // A maintenance block occupies exactly its own period (no set-up or clean-up) and may be planned while a room is out of service;
    // it uses the same room and exclusion-pair guards as a reservation, so the two conflict through the allocator.
    internal async Task<AllocationSpec[]> BuildSpecsAsync(string parish, string[] selected, DateTimeOffset start, DateTimeOffset end, CancellationToken ct, bool maintenance = false)
    {
        var all = (await records.CollectAsync<Facility>(SchedulingScope.For(parish), "facility", ct)).Select(row => row.Value).ToDictionary(value => value.Id, StringComparer.Ordinal);
        var specs = new List<AllocationSpec>();
        foreach (var id in selected)
        {
            if (!all.TryGetValue(id, out var facility))
                throw SchedulingScope.Missing();
            if (facility.ExclusionResourceIds.Any(excluded => !all.ContainsKey(excluded)))
                throw new DomainException("facility_graph_requires_review", "A configured exclusion lacks its actual parish facility; review the resource graph.", FailureKind.Conflict);
            if (facility.Status != "Serviceable" && !maintenance)
                throw new DomainException("facility_unavailable", "A selected facility is out of service.", FailureKind.Conflict);
            DateTimeOffset a, b;
            try
            { a = maintenance ? start : start.AddMinutes(-facility.SetupMinutes); b = maintenance ? end : end.AddMinutes(facility.CleanupMinutes); }
            catch (ArgumentOutOfRangeException) { throw new DomainException("invalid_period", "Setup or cleanup exceeds the supported date range."); }
            specs.Add(new() { ResourceId = FacilityKey(parish, id), StartsAt = a, EndsAt = b, Quantity = 1, Capacity = 1 });
            foreach (var other in all.Values.Where(other => other.Id != id && (facility.ExclusionResourceIds.Contains(other.Id) || other.ExclusionResourceIds.Contains(id))))
            {
                var pair = new[] { id, other.Id }.Order(StringComparer.Ordinal).ToArray();
                specs.Add(new() { ResourceId = "facility-pair:" + parish + ":" + pair[0] + ":" + pair[1], StartsAt = a, EndsAt = b, Quantity = 1, Capacity = 1 });
            }
        }
        var merged = specs.GroupBy(spec => spec.ResourceId, StringComparer.Ordinal).Select(group => new AllocationSpec
        { ResourceId = group.Key, StartsAt = group.Min(spec => spec.StartsAt), EndsAt = group.Max(spec => spec.EndsAt), Quantity = 1, Capacity = 1 }).OrderBy(spec => spec.ResourceId, StringComparer.Ordinal).ToArray();
        if (merged.Length > 75)
            throw new DomainException("allocation_limit", "This resource graph needs a smaller reviewed reservation scope.");
        return merged;
    }
    internal async Task<Versioned<Facility>> ReadAsync(string parish, string id, CancellationToken ct)
        => await records.ReadAsync<Facility>(SchedulingScope.For(parish), "facility:" + id, ct) ?? throw SchedulingScope.Missing();
    private async Task RequireNoFutureBookings(string parish, HashSet<string> affected, CancellationToken ct)
    {
        var facilities = (await records.CollectAsync<Facility>(SchedulingScope.For(parish), "facility", ct)).ToDictionary(row => row.Value.Id, row => row.Value);
        var rows = await records.CollectAsync<Reservation>(SchedulingScope.For(parish), "reservation", ct, 5000,
            new RecordCondition { Path = "endsAt", Comparison = "gt", Value = clock.GetUtcNow().AddDays(-1) });
        if (rows.Any(row => !SchedulingScope.IsEnded(row.Value) && row.Value.AllocationResourceIds.Any(affected.Contains)
            && row.Value.EndsAt > clock.GetUtcNow().AddMinutes(-row.Value.AllocationResourceIds.Select(id => facilities.TryGetValue(id, out var facility)
                ? Math.Clamp(facility.CleanupMinutes, 0, 1440) : 1440).DefaultIfEmpty(0).Max())))
            throw new DomainException("facility_dependencies_active", "Resolve affected current/future reservations before changing resource structure or serviceability.", FailureKind.Conflict);
    }
    private async Task RequireNoActiveMaintenance(string parish, HashSet<string> affected, CancellationToken ct)
    {
        var rows = await records.CollectAsync<MaintenanceBlock>(SchedulingScope.For(parish), "maintenanceBlock", ct, 5000,
            new RecordCondition { Path = "endsAt", Comparison = "gt", Value = clock.GetUtcNow() });
        if (rows.Any(row => row.Value.Status is "Allocating" or "Active" && affected.Contains(row.Value.FacilityId)))
            throw new DomainException("facility_dependencies_active", "Cancel affected current/future maintenance blocks before changing what excludes what.", FailureKind.Conflict);
    }
    internal static string FacilityKey(string parish, string id) => "facility:" + parish + ":" + id;
    private static FacilityDto View(Facility value) => new()
    {
        Id = value.Id,
        ParishId = value.ParishId,
        Name = value.Name,
        NameAr = value.NameAr,
        Kind = value.Kind,
        Capacity = value.Capacity,
        SetupMinutes = value.SetupMinutes,
        CleanupMinutes = value.CleanupMinutes,
        Status = value.Status,
        ExclusionResourceIds = [.. value.ExclusionResourceIds],
        PublicDescription = value.PublicDescription,
        PublicDescriptionAr = value.PublicDescriptionAr
    };
}
