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

/// <summary>Notices: publishing needs the notices.publish permission (secretary yes, member no), and notices are tenant-scoped.</summary>
public class NoticeTests : IClassFixture<TestAppFactory>
{
    private readonly TestAppFactory _factory;
    public NoticeTests(TestAppFactory factory) => _factory = factory;

    private (AppDbContext Db, NoticeService Service) Make(string user, SystemRole role, params Guid[] parishes)
    {
        _ = _factory.Services;
        var options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_factory.Connection).Options;
        var tenant = new StaticTenantContext(SeedIds.Org, parishes, false, user) { ActingRole = role.ToString() };
        var db = new AppDbContext(options, tenant);
        var perms = new PermissionService(db);
        return (db, new NoticeService(db, tenant, perms, new AuditService(db, tenant, perms)));
    }

    private async Task<string> IdOf(string email)
    {
        using var scope = _factory.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        return (await users.FindByEmailAsync(email))!.Id;
    }

    [Fact]
    public async Task Secretary_can_publish_a_notice_and_it_appears_in_recent()
    {
        var secretary = await IdOf(SeedIds.SecretaryAEmail);
        var (db, svc) = Make(secretary, SystemRole.Secretary, SeedIds.ParishA);
        await using var __ = db;

        var id = await svc.PublishAsync(new PublishNoticeRequest(
            "Parish council meeting", "The council meets on Thursday at 20:00.",
            NoticePriority.Normal, NoticeAudience.Committees, null), secretary);

        var recent = await svc.ListRecentAsync();
        Assert.Contains(recent, n => n.Id == id && n.Title == "Parish council meeting");
    }

    [Fact]
    public async Task Member_cannot_publish_a_notice()
    {
        var rita = await IdOf(SeedIds.RitaEmail);
        var (db, svc) = Make(rita, SystemRole.Member, SeedIds.ParishA);
        await using var __ = db;

        await Assert.ThrowsAsync<ForbiddenException>(() => svc.PublishAsync(
            new PublishNoticeRequest("Nope", "Not allowed.", NoticePriority.Normal, NoticeAudience.Members, null), rita));
    }

    [Fact]
    public async Task Notices_are_tenant_scoped()
    {
        var (dbB, svcB) = Make(await IdOf(SeedIds.PriestBEmail), SystemRole.Priest, SeedIds.ParishB);
        await using var __ = dbB;

        var recent = await svcB.ListRecentAsync();
        Assert.DoesNotContain(recent, n => n.Title.StartsWith("St. George")); // Parish A's notice
    }

    [Fact]
    public async Task Ordinary_member_cannot_read_committee_notice_through_list_or_api()
    {
        using var scope = _factory.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var ordinary = new ApplicationUser { UserName = "fictional-notice-reader-" + Guid.NewGuid(), DisplayName = "Fictional ordinary reader" };
        Assert.True((await users.CreateAsync(ordinary)).Succeeded);
        var options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_factory.Connection).Options;
        await using (var setup = new AppDbContext(options, new StaticTenantContext(SeedIds.Org, [], true)))
        { setup.Memberships.Add(new ParishLive.Domain.Entities.Membership { OrgId = SeedIds.Org, ParishId = SeedIds.ParishA, UserId = ordinary.Id, Role = SystemRole.Member }); await setup.SaveChangesAsync(); }
        var secretary = await IdOf(SeedIds.SecretaryAEmail);
        var (officeDb, office) = Make(secretary, SystemRole.Secretary, SeedIds.ParishA);
        await using (officeDb)
        {
            await office.PublishAsync(new("FICTIONAL-PRIVATE-COMMITTEE", "Restricted committee text", NoticePriority.Normal, NoticeAudience.Committees, null), secretary);
            await office.PublishAsync(new("FICTIONAL-MEMBER-NOTICE", "Permitted member text", NoticePriority.Normal, NoticeAudience.Members, null), secretary);
        }
        var (memberDb, member) = Make(ordinary.Id, SystemRole.Member, SeedIds.ParishA);
        await using (memberDb)
        {
            var rows = await member.ListRecentAsync(); Assert.DoesNotContain(rows, n => n.Title == "FICTIONAL-PRIVATE-COMMITTEE");
            Assert.Contains(rows, n => n.Title == "FICTIONAL-MEMBER-NOTICE");
        }
        var client = _factory.CreateClient(); client.DefaultRequestHeaders.Add(TestAuthHandler.UserHeader, ordinary.Id);
        var api = await client.GetStringAsync("/api/notices"); Assert.DoesNotContain("FICTIONAL-PRIVATE-COMMITTEE", api); Assert.Contains("FICTIONAL-MEMBER-NOTICE", api);
    }
}
