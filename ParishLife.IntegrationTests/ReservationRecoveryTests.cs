// Purpose: tests partial allocation compensation, recoverable service failure and configuration dependency fences against real isolated storage.
// Main tests: partial holds are released on conflict; unknown service failure resumes safely under a new lease; maintenance/configuration cannot invalidate current bookings.

using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Scheduling;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Repositories.Scheduling;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Scheduling;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class ReservationRecoveryTests
{
    [Fact]
    public async Task Partial_allocation_is_compensated_without_releasing_another_confirmed_booking()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var s = await SchedulingScenario.CreateAsync(fixture);
        var rooms = new[] { await s.FacilityAsync(), await s.FacilityAsync() }.OrderBy(room => room.Id, StringComparer.Ordinal).ToArray();
        var busy = await s.ActAsync((await s.RequestAsync(await s.EventAsync(), rooms[1].Id)).Id, "confirm");
        await s.Processor.ProcessOneAsync(s.Parish, busy.CurrentWorkId!, "fixture-worker", default);
        var target = await s.ActAsync((await s.RequestAsync(await s.EventAsync(), rooms.Select(room => room.Id).ToArray())).Id, "confirm");
        await s.Processor.ProcessOneAsync(s.Parish, target.CurrentWorkId!, "fixture-worker", default);
        s.Use();
        Assert.Equal("Conflict", (await s.Reservations.GetAsync(s.Parish, target.Id, default)).Value.Status);
        var allocator = fixture.Services.GetRequiredService<IResourceAllocator>();
        Assert.Empty(await allocator.BusyAsync(FacilityService.FacilityKey(s.Parish, rooms[0].Id), target.StartsAt, target.EndsAt, default));
        Assert.Equal(busy.Id, Assert.Single(await allocator.BusyAsync(FacilityService.FacilityKey(s.Parish, rooms[1].Id), target.StartsAt, target.EndsAt, default)).BookingId);
    }

    [Fact]
    public async Task Unknown_service_failure_keeps_pending_state_and_a_new_worker_resumes_after_lease_expiry()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var s = await SchedulingScenario.CreateAsync(fixture);
        var rooms = new[] { await s.FacilityAsync(), await s.FacilityAsync() };
        var target = await s.ActAsync((await s.RequestAsync(await s.EventAsync(), rooms.Select(room => room.Id).ToArray())).Id, "confirm");
        var fault = new FailSecondHold(fixture.Services.GetRequiredService<IResourceAllocator>());
        var processor = new ReservationProcessor(fixture.Services.GetRequiredService<IRecordTransactions>(), fault,
            fixture.Services.GetRequiredService<IParishRepository>(), fixture.Services.GetRequiredService<ReservationWorkAuthorization>(), fixture.Clock);
        Assert.Equal(FailureKind.Unavailable, (await Assert.ThrowsAsync<DomainException>(() => processor.ProcessOneAsync(s.Parish, target.CurrentWorkId!, "old-worker", default))).Kind);
        s.Use();
        Assert.Equal("Allocating", (await s.Reservations.GetAsync(s.Parish, target.Id, default)).Value.Status);
        await s.Processor.ProcessOneAsync(s.Parish, target.CurrentWorkId!, "new-worker", default);
        Assert.Equal("Allocating", (await s.Reservations.GetAsync(s.Parish, target.Id, default)).Value.Status);
        fixture.Clock.Now = fixture.Clock.Now.AddMinutes(2).AddSeconds(1);
        await s.Processor.ProcessOneAsync(s.Parish, target.CurrentWorkId!, "new-worker", default);
        Assert.Equal("Confirmed", (await s.Reservations.GetAsync(s.Parish, target.Id, default)).Value.Status);
        foreach (var room in rooms)
            Assert.Single(await fixture.Services.GetRequiredService<IResourceAllocator>().BusyAsync(FacilityService.FacilityKey(s.Parish, room.Id), target.StartsAt, target.EndsAt, default));
    }

    [Fact]
    public async Task Serviceability_and_structural_changes_require_resolving_affected_future_bookings()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var s = await SchedulingScenario.CreateAsync(fixture);
        var room = await s.FacilityAsync();
        var target = await s.ActAsync((await s.RequestAsync(await s.EventAsync(), room.Id)).Id, "confirm");
        await s.Processor.ProcessOneAsync(s.Parish, target.CurrentWorkId!, "fixture-worker", default);
        s.Use();
        var before = await s.Facilities.GetAsync(s.Parish, room.Id, default);
        Assert.Equal("facility_dependencies_active", (await Assert.ThrowsAsync<DomainException>(() => s.Facilities.SetStatusAsync(s.Parish, room.Id,
            new FacilityStatusDto { OperationId = Guid.NewGuid(), Version = before.Version, Status = "OutOfService", Reason = "Maintenance fixture" }, default))).Code);
        Assert.Equal(before.Version, (await s.Facilities.GetAsync(s.Parish, room.Id, default)).Version);
        Assert.Equal("facility_dependencies_active", (await Assert.ThrowsAsync<DomainException>(() => s.Facilities.SaveAsync(s.Parish, room.Id,
            new SaveFacilityDto { OperationId = Guid.NewGuid(), Version = before.Version, Name = room.Name, Kind = room.Kind, Capacity = 20, SetupMinutes = 30 }, default))).Code);
        await s.ActAsync(target.Id, "cancel");
        await s.Processor.ProcessOneAsync(s.Parish, target.CurrentWorkId!, "fixture-worker", default);
        s.Use();
        await s.Facilities.SetStatusAsync(s.Parish, room.Id, new FacilityStatusDto { OperationId = Guid.NewGuid(), Version = before.Version, Status = "OutOfService", Reason = "Actual isolated maintenance" }, default);
        Assert.Equal("Unavailable", Assert.Single(await s.Facilities.AvailabilityAsync(s.Parish, room.Id, target.StartsAt, target.EndsAt, default)).Status);
        var next = await s.EventAsync();
        Assert.Equal("facility_unavailable", (await Assert.ThrowsAsync<DomainException>(() => s.RequestAsync(next, room.Id))).Code);
    }

    private class FailSecondHold(IResourceAllocator inner) : IResourceAllocator
    {
        private int calls;
        public Task HoldAsync(AllocationRequest request, string operationId, DateTimeOffset expiresAt, CancellationToken ct)
            => Interlocked.Increment(ref calls) == 2 ? throw new DomainException("simulated_service_failure", "Isolated service failure.", FailureKind.Unavailable)
                : inner.HoldAsync(request, operationId, expiresAt, ct);
        public Task ConfirmAsync(string resourceId, string operationId, CancellationToken ct) => inner.ConfirmAsync(resourceId, operationId, ct);
        public Task ReleaseAsync(string resourceId, string operationId, CancellationToken ct) => inner.ReleaseAsync(resourceId, operationId, ct);
        public Task<IReadOnlyList<ResourceAllocation>> BusyAsync(string resourceId, DateTimeOffset start, DateTimeOffset end, CancellationToken ct) => inner.BusyAsync(resourceId, start, end, ct);
    }
}
