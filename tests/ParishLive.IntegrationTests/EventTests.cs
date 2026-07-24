using Microsoft.EntityFrameworkCore;
using ParishLive.Application.Abstractions;
using ParishLive.Domain.Common;
using ParishLive.Infrastructure.Data;
using ParishLive.Infrastructure.Events;
using Xunit;

namespace ParishLive.IntegrationTests;

/// <summary>Phase 4: events are tenant-scoped, upcoming events surface, and registration respects capacity + idempotency.</summary>
public class EventTests : IClassFixture<TestAppFactory>
{
    private readonly TestAppFactory _factory;
    public EventTests(TestAppFactory factory) => _factory = factory;

    private (AppDbContext Db, EventService Service) Make(params Guid[] parishes)
    {
        _ = _factory.Services;
        var options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_factory.Connection).Options;
        var db = new AppDbContext(options, new StaticTenantContext(SeedIds.Org, parishes, false));
        return (db, new EventService(db));
    }

    [Fact]
    public async Task Upcoming_events_are_listed_for_the_parish()
    {
        var (db, svc) = Make(SeedIds.ParishA);
        await using var __ = db;

        var upcoming = await svc.ListUpcomingAsync();
        Assert.Contains(upcoming, e => e.Title == "Youth Summer Camp");
        Assert.Contains(upcoming, e => e.Title == "Feast of the Assumption — Mass");
    }

    [Fact]
    public async Task Events_are_tenant_scoped()
    {
        var (dbB, svcB) = Make(SeedIds.ParishB);
        await using var __ = dbB;
        Assert.Empty(await svcB.ListUpcomingAsync());
    }

    [Fact]
    public async Task Registering_is_idempotent_and_counts_once()
    {
        var (db, svc) = Make(SeedIds.ParishA);
        await using var __ = db;

        var camp = (await svc.ListUpcomingAsync()).First(e => e.Title == "Youth Summer Camp");
        var before = camp.Registrations;

        await svc.RegisterAsync(camp.Id, "another-member");
        await svc.RegisterAsync(camp.Id, "another-member"); // repeat — no double count

        var detail = await svc.GetAsync(camp.Id, "another-member");
        Assert.Equal(before + 1, detail!.Registrations);
        Assert.True(detail.IsRegistered);
    }

    [Fact]
    public async Task Registration_is_blocked_when_the_event_is_full()
    {
        var (db, svc) = Make(SeedIds.ParishA);
        await using var __ = db;

        // Create a full event (capacity 1) directly, then a second registration must fail.
        var ev = Domain.Entities.Event.Create(SeedIds.Org, SeedIds.ParishA, "Tiny workshop", null, null, null,
            new DateTimeOffset(2026, 9, 5, 18, 0, 0, TimeSpan.Zero), new DateTimeOffset(2026, 9, 5, 19, 0, 0, TimeSpan.Zero),
            capacity: 1, Domain.Enums.EventVisibility.Members, registrationOpen: true);
        db.Events.Add(ev);
        await db.SaveChangesAsync();

        await svc.RegisterAsync(ev.Id, "first");
        await Assert.ThrowsAsync<DomainException>(() => svc.RegisterAsync(ev.Id, "second"));
    }
}
