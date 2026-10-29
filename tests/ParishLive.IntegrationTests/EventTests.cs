using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using ParishLive.Application.Abstractions;
using ParishLive.Domain.Entities;
using ParishLive.Domain.Enums;
using ParishLive.Infrastructure.Authorization;
using ParishLive.Infrastructure.Data;
using ParishLive.Infrastructure.Events;
using ParishLive.Infrastructure.Identity;
using ParishLive.Infrastructure.Operations;
using Xunit;

namespace ParishLive.IntegrationTests;

public class EventTests : IClassFixture<TestAppFactory>
{
    private readonly TestAppFactory factory;
    public EventTests(TestAppFactory factory) { this.factory = factory; _ = factory.Services; }
    private async Task<string> UserAsync(string email)
    {
        using var scope = factory.Services.CreateScope();
        return (await scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>().FindByEmailAsync(email))!.Id;
    }
    private (AppDbContext Db, EventService Service) Make(string user, SystemRole role, Guid parish)
    {
        var tenant = new StaticTenantContext(SeedIds.Org, [parish], false, user) { ActingRole = role.ToString() };
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(factory.Connection).Options, tenant);
        var admissions = new EventAdmissionService(db, tenant, new OperationalAccess(db, tenant), new OperationRunner(db, tenant));
        return (db, new EventService(db, tenant, admissions));
    }
    private static async Task<Guid> UpcomingAsync(AppDbContext db, int capacity = 10)
    {
        var start = DateTimeOffset.UtcNow.AddDays(3);
        var item = Event.Create(SeedIds.Org, SeedIds.ParishA, "Fictional test workshop " + Guid.NewGuid(), null,
            null, null, start, start.AddHours(2), capacity, EventVisibility.Members, true);
        db.Events.Add(item); await db.SaveChangesAsync(); return item.Id;
    }
    [Fact]
    public async Task Upcoming_events_are_listed_for_the_parish()
    {
        var (db, svc) = Make(await UserAsync(SeedIds.PriestAEmail), SystemRole.Priest, SeedIds.ParishA); await using var owned = db;
        var id = await UpcomingAsync(db);
        Assert.Contains(await svc.ListUpcomingAsync(), e => e.Id == id);
    }
    [Fact]
    public async Task Events_are_tenant_scoped()
    {
        var (db, svc) = Make(await UserAsync(SeedIds.PriestBEmail), SystemRole.Priest, SeedIds.ParishB); await using var owned = db;
        Assert.Empty(await svc.ListUpcomingAsync());
    }
    [Fact]
    public async Task Registering_is_idempotent_and_counts_a_real_reserved_place_once()
    {
        var user = await UserAsync(SeedIds.PriestAEmail);
        var (db, svc) = Make(user, SystemRole.Priest, SeedIds.ParishA); await using var owned = db;
        var id = await UpcomingAsync(db);
        await svc.RegisterAsync(id, user); await svc.RegisterAsync(id, user);
        var detail = await svc.GetAsync(id, user);
        Assert.Equal(1, detail!.Registrations); Assert.True(detail.IsRegistered);
        Assert.Equal(PlaceStatus.Reserved, (await db.EventAdmissions.SingleAsync(a => a.EventId == id)).Place);
        Assert.False((await db.EventAdmissions.SingleAsync(a => a.EventId == id)).ConsentVerified);
    }
    [Fact]
    public async Task Full_event_waitlists_second_applicant_without_exceeding_capacity()
    {
        var priest = await UserAsync(SeedIds.PriestAEmail); var secretary = await UserAsync(SeedIds.SecretaryAEmail);
        var (db, svc) = Make(priest, SystemRole.Priest, SeedIds.ParishA); await using var owned = db;
        var id = await UpcomingAsync(db, 1); await svc.RegisterAsync(id, priest);
        var (otherDb, otherSvc) = Make(secretary, SystemRole.Secretary, SeedIds.ParishA); await using var other = otherDb;
        await otherSvc.RegisterAsync(id, secretary);
        Assert.Equal(1, await db.EventAdmissions.CountAsync(a => a.EventId == id && a.Place == PlaceStatus.Reserved));
        Assert.Equal(1, await db.EventAdmissions.CountAsync(a => a.EventId == id && a.Place == PlaceStatus.Waitlisted));
    }
}
