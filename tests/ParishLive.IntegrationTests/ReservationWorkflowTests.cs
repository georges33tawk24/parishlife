using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using ParishLive.Application.Abstractions;
using ParishLive.Application.Common;
using ParishLive.Application.Reservations;
using ParishLive.Domain.Common;
using ParishLive.Infrastructure.Audit;
using ParishLive.Infrastructure.Authorization;
using ParishLive.Infrastructure.Data;
using ParishLive.Infrastructure.Identity;
using ParishLive.Infrastructure.Reservations;
using Xunit;

namespace ParishLive.IntegrationTests;

/// <summary>
/// Phase 3 + RBAC: reservations move through the configurable workflow, actions are only permitted to
/// those with the required permission (a secretary may review but not approve), notes are enforced,
/// history is recorded, and everything stays tenant-scoped.
/// </summary>
public class ReservationWorkflowTests : IClassFixture<TestAppFactory>
{
    private readonly TestAppFactory _factory;
    public ReservationWorkflowTests(TestAppFactory factory) => _factory = factory;

    private (AppDbContext Db, ReservationService Service) Make(string? userId, params Guid[] parishes)
    {
        _ = _factory.Services; // ensure host started + seeded
        var options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_factory.Connection).Options;
        var tenant = new StaticTenantContext(SeedIds.Org, parishes, false, userId);
        var db = new AppDbContext(options, tenant);
        var perms = new PermissionService(db);
        return (db, new ReservationService(db, tenant, perms, new AuditService(db, tenant, perms)));
    }

    private async Task<string> IdOf(string email)
    {
        using var scope = _factory.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        return (await users.FindByEmailAsync(email))!.Id;
    }

    private async Task<Guid> NewForwardedReservationAsync(AppDbContext db, ReservationService svc, string requester, string secretary, string title)
    {
        var venueId = await db.Venues.Select(v => v.Id).FirstAsync();
        var id = await svc.CreateAsync(new CreateReservationRequest(
            SeedIds.YouthGroup, venueId, requester, title, null,
            new DateTimeOffset(2026, 8, 1, 18, 0, 0, TimeSpan.Zero),
            new DateTimeOffset(2026, 8, 1, 20, 0, 0, TimeSpan.Zero), 30));
        await svc.PerformActionAsync(id, "SubmitForReview", null, requester);  // member has reservations.create
        await svc.PerformActionAsync(id, "Forward", null, secretary);          // secretary has reservations.review
        return id;
    }

    [Fact]
    public async Task Seeded_reservation_is_forwarded_to_priest_with_history_and_approve_reject_actions()
    {
        var (db, svc) = Make(await IdOf(SeedIds.PriestAEmail), SeedIds.ParishA);
        await using var __ = db;

        var seeded = (await svc.ListAsync()).Single(r => r.Title.StartsWith("Youth Group"));
        Assert.Equal("ForwardedToPriest", seeded.StateCode);

        var detail = await svc.GetAsync(seeded.Id);
        Assert.Equal(2, detail!.History.Count);
        Assert.Contains(detail.Actions, a => a.ActionCode == "Approve");
        Assert.Contains(detail.Actions, a => a.ActionCode == "Reject" && a.RequiresNote);
    }

    [Fact]
    public async Task Priest_can_approve_a_forwarded_reservation()
    {
        var priest = await IdOf(SeedIds.PriestAEmail);
        var (db, svc) = Make(priest, SeedIds.ParishA);
        await using var __ = db;

        var id = await NewForwardedReservationAsync(db, svc, await IdOf(SeedIds.RitaEmail), await IdOf(SeedIds.SecretaryAEmail), "Approve me");
        await svc.PerformActionAsync(id, "Approve", null, priest);

        var detail = await svc.GetAsync(id);
        Assert.Equal("Approved", detail!.StateCode);
        Assert.Contains(detail.History, h => h.ToState == "Approved");
    }

    [Fact]
    public async Task Secretary_cannot_approve_a_reservation()
    {
        var secretary = await IdOf(SeedIds.SecretaryAEmail);
        var (db, svc) = Make(secretary, SeedIds.ParishA);
        await using var __ = db;

        var id = await NewForwardedReservationAsync(db, svc, await IdOf(SeedIds.RitaEmail), secretary, "Secretary approve attempt");

        await Assert.ThrowsAsync<ForbiddenException>(() => svc.PerformActionAsync(id, "Approve", null, secretary));
    }

    [Fact]
    public async Task Approve_action_is_hidden_from_a_secretary()
    {
        var (db, svc) = Make(await IdOf(SeedIds.SecretaryAEmail), SeedIds.ParishA);
        await using var __ = db;

        var seeded = (await svc.ListAsync()).Single(r => r.Title.StartsWith("Youth Group"));
        var detail = await svc.GetAsync(seeded.Id);

        Assert.DoesNotContain(detail!.Actions, a => a.ActionCode == "Approve"); // lacks reservations.approve
    }

    [Fact]
    public async Task An_action_not_valid_from_the_current_state_is_rejected()
    {
        var priest = await IdOf(SeedIds.PriestAEmail);
        var (db, svc) = Make(priest, SeedIds.ParishA);
        await using var __ = db;

        var venueId = await db.Venues.Select(v => v.Id).FirstAsync();
        var id = await svc.CreateAsync(new CreateReservationRequest(
            SeedIds.YouthGroup, venueId, await IdOf(SeedIds.RitaEmail), "Skip review", null,
            new DateTimeOffset(2026, 9, 2, 18, 0, 0, TimeSpan.Zero),
            new DateTimeOffset(2026, 9, 2, 20, 0, 0, TimeSpan.Zero), 25));

        await Assert.ThrowsAsync<DomainException>(() => svc.PerformActionAsync(id, "Approve", null, priest));
    }

    [Fact]
    public async Task Reject_requires_a_note()
    {
        var priest = await IdOf(SeedIds.PriestAEmail);
        var (db, svc) = Make(priest, SeedIds.ParishA);
        await using var __ = db;

        var id = await NewForwardedReservationAsync(db, svc, await IdOf(SeedIds.RitaEmail), await IdOf(SeedIds.SecretaryAEmail), "Reject me");
        await Assert.ThrowsAsync<DomainException>(() => svc.PerformActionAsync(id, "Reject", null, priest));

        await svc.PerformActionAsync(id, "Reject", "Date clashes with the parish feast.", priest);
        Assert.Equal("Rejected", (await svc.GetAsync(id))!.StateCode);
    }

    [Fact]
    public async Task New_reservation_starts_in_the_initial_state()
    {
        var rita = await IdOf(SeedIds.RitaEmail);
        var (db, svc) = Make(rita, SeedIds.ParishA);
        await using var __ = db;

        var venueId = await db.Venues.Select(v => v.Id).FirstAsync();
        var id = await svc.CreateAsync(new CreateReservationRequest(
            SeedIds.YouthGroup, venueId, rita, "Choir practice", null,
            new DateTimeOffset(2026, 9, 1, 18, 0, 0, TimeSpan.Zero),
            new DateTimeOffset(2026, 9, 1, 20, 0, 0, TimeSpan.Zero), 25));

        Assert.Equal("Submitted", (await svc.GetAsync(id))!.StateCode);
    }

    [Fact]
    public async Task Reservations_are_tenant_scoped()
    {
        var (dbB, svcB) = Make(await IdOf(SeedIds.PriestBEmail), SeedIds.ParishB);
        await using var __ = dbB;
        Assert.Empty(await svcB.ListAsync());
    }
}
