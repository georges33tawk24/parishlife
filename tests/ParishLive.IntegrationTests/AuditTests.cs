using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using ParishLive.Application.Abstractions;
using ParishLive.Application.Common;
using ParishLive.Application.Notices;
using ParishLive.Domain.Enums;
using ParishLive.Infrastructure.Audit;
using ParishLive.Infrastructure.Authorization;
using ParishLive.Infrastructure.Data;
using ParishLive.Infrastructure.Identity;
using ParishLive.Infrastructure.Notices;
using Xunit;

namespace ParishLive.IntegrationTests;

/// <summary>
/// Audit log (spec §22): key actions are recorded, only the audit.view permission may read them
/// (priest yes, member no), and the trail is tenant-scoped like everything else.
/// </summary>
public class AuditTests : IClassFixture<TestAppFactory>
{
    private readonly TestAppFactory _factory;
    public AuditTests(TestAppFactory factory) => _factory = factory;

    private (AppDbContext Db, StaticTenantContext Tenant, PermissionService Perms) Ctx(string? userId, params Guid[] parishes)
    {
        _ = _factory.Services; // ensure host started + seeded
        var options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_factory.Connection).Options;
        var tenant = new StaticTenantContext(SeedIds.Org, parishes, false, userId);
        var db = new AppDbContext(options, tenant);
        return (db, tenant, new PermissionService(db));
    }

    private async Task<string> IdOf(string email)
    {
        using var scope = _factory.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        return (await users.FindByEmailAsync(email))!.Id;
    }

    [Fact]
    public async Task Priest_can_view_the_audit_log_and_sees_seeded_actions()
    {
        var priest = await IdOf(SeedIds.PriestAEmail);
        var (db, tenant, perms) = Ctx(priest, SeedIds.ParishA);
        await using var __ = db;
        var audit = new AuditService(db, tenant, perms);

        Assert.True(await audit.CanViewAsync(priest));
        var entries = await audit.ListRecentAsync();
        Assert.Contains(entries, e => e.Action == "reservation.Forward");
    }

    [Fact]
    public async Task Member_cannot_view_the_audit_log()
    {
        var rita = await IdOf(SeedIds.RitaEmail);
        var (db, tenant, perms) = Ctx(rita, SeedIds.ParishA);
        await using var __ = db;
        var audit = new AuditService(db, tenant, perms);

        Assert.False(await audit.CanViewAsync(rita));
        await Assert.ThrowsAsync<ForbiddenException>(() => audit.ListRecentAsync());
    }

    [Fact]
    public async Task Publishing_a_notice_records_an_audit_entry()
    {
        var secretary = await IdOf(SeedIds.SecretaryAEmail);
        var priest = await IdOf(SeedIds.PriestAEmail);

        // Publish as the secretary — the service should write an audit entry.
        var (dbW, tenantW, permsW) = Ctx(secretary, SeedIds.ParishA);
        await using (dbW)
        {
            var notices = new NoticeService(dbW, tenantW, permsW, new AuditService(dbW, tenantW, permsW));
            await notices.PublishAsync(new PublishNoticeRequest(
                "Audit-probe notice", "Body.", NoticePriority.Normal, NoticeAudience.Members, null), secretary);
        }

        // Read the trail as the priest.
        var (dbR, tenantR, permsR) = Ctx(priest, SeedIds.ParishA);
        await using var __ = dbR;
        var entries = await new AuditService(dbR, tenantR, permsR).ListRecentAsync();

        Assert.Contains(entries, e =>
            e.Action == "notice.publish" && e.Actor == "M. Haddad" && e.Summary.Contains("Audit-probe notice"));
    }

    [Fact]
    public async Task Audit_log_is_tenant_scoped()
    {
        var priestB = await IdOf(SeedIds.PriestBEmail);
        var (db, tenant, perms) = Ctx(priestB, SeedIds.ParishB);
        await using var __ = db;
        var audit = new AuditService(db, tenant, perms);

        var entries = await audit.ListRecentAsync();
        Assert.DoesNotContain(entries, e => e.Summary.Contains("Youth Group — Fundraising dinner")); // Parish A's action
    }
}
