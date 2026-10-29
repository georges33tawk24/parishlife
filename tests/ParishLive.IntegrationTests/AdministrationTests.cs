using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using ParishLive.Application.Abstractions;
using ParishLive.Application.Common;
using ParishLive.Domain.Common;
using ParishLive.Domain.Entities;
using ParishLive.Domain.Enums;
using ParishLive.Infrastructure.Authorization;
using ParishLive.Infrastructure.Data;
using ParishLive.Infrastructure.Identity;
using ParishLive.Infrastructure.Operations;
using Xunit;

namespace ParishLive.IntegrationTests;

public sealed class AdministrationTests(TestAppFactory factory) : IClassFixture<TestAppFactory>
{
    [Fact]
    public async Task Delegated_diocesan_admin_can_activate_first_parish_without_secretary_then_head_priest_invites_and_revokes_one_scope()
    {
        using var scope = factory.Services.CreateScope(); var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite(factory.Connection).Options;
        var administrator = (await users.FindByEmailAsync(SeedIds.RitaEmail))!.Id;
        var priest = (await users.FindByEmailAsync(SeedIds.PriestBEmail))!.Id;
        var secretary = (await users.FindByEmailAsync(SeedIds.SecretaryAEmail))!.Id;
        var grant = new Membership { OrgId = SeedIds.Org, UserId = administrator, Role = SystemRole.ArchdioceseAdmin, MayCreateParishes = true };
        await using (var setup = new AppDbContext(options, new StaticTenantContext(SeedIds.Org, [], true))) { setup.Memberships.Add(grant); await setup.SaveChangesAsync(); }
        var tenant = new StaticTenantContext(SeedIds.Org, [], true, administrator) { ActingRole = "ArchdioceseAdmin", ActingAssignmentId = grant.Id };
        Guid parish;
        await using (var db = new AppDbContext(options, tenant))
        {
            parish = await new AdministrationService(db, tenant, users).CreateAndActivateParishAsync(new(SeedIds.Org,
                "Fictional approved parish", "Paroisse fictive approuvée", "رعية اختبار معتمدة", "Fictional locality", "Fictional office contact",
                "FICTIONAL-JURISDICTION", "FICTIONAL-ADOPTION", SeedIds.PriestBEmail, "FICTIONAL-ACTUAL-APPOINTMENT-AND-CONSENT", Guid.NewGuid()));
            Assert.True((await db.Parishes.SingleAsync(p => p.Id == parish)).PubliclyListed);
            Assert.False(await db.Memberships.AnyAsync(m => m.ParishId == parish && m.Role == SystemRole.Secretary));
        }
        Membership head;
        await using (var setup = new AppDbContext(options, tenant)) head = await setup.Memberships.SingleAsync(m => m.ParishId == parish && m.UserId == priest);
        var headTenant = new StaticTenantContext(SeedIds.Org, [parish], false, priest) { ActingRole = "Priest", ActingAssignmentId = head.Id };
        Guid invitation;
        await using (var db = new AppDbContext(options, headTenant))
        {
            var service = new AdministrationService(db, headTenant, users);
            invitation = await service.OfferAppointmentAsync(new(SeedIds.SecretaryAEmail, SystemRole.Secretary, SeedIds.Org, parish, null,
                DateTimeOffset.UtcNow.AddMinutes(-1), null, "FICTIONAL-SCOPED-OFFICE-DUTY", Guid.NewGuid()));
            await Assert.ThrowsAsync<ForbiddenException>(() => service.OfferAppointmentAsync(new(SeedIds.SecretaryAEmail, SystemRole.Archbishop, SeedIds.Org, Guid.Empty,
                null, DateTimeOffset.UtcNow, null, "Invalid escalation", Guid.NewGuid())));
        }
        var invited = new StaticTenantContext(SeedIds.Org, [parish], false, secretary) { ActingRole = "Secretary", ActingAssignmentId = invitation };
        await using (var db = new AppDbContext(options, invited))
        {
            await Assert.ThrowsAsync<ForbiddenException>(() => new OperationalAccess(db, invited).OfficeAsync(parish));
            await new AdministrationService(db, invited, users).AcceptAsync(invitation, true);
            Assert.Equal(secretary, (await new OperationalAccess(db, invited).OfficeAsync(parish)).UserId);
            await Assert.ThrowsAsync<ForbiddenException>(() => new OperationalAccess(db, invited).RequireAsync(parish, SystemRole.Priest));
        }
        await using (var db = new AppDbContext(options, headTenant)) await new AdministrationService(db, headTenant, users).RevokeAsync(invitation, 2, "FICTIONAL-END-OF-DUTY", Guid.NewGuid());
        await using (var db = new AppDbContext(options, invited))
        {
            await Assert.ThrowsAsync<ForbiddenException>(() => new OperationalAccess(db, invited).OfficeAsync(parish));
            Assert.True((await db.Memberships.IgnoreQueryFilters().SingleAsync(m => m.UserId == secretary && m.ParishId == SeedIds.ParishA)).IsEffective(DateTimeOffset.UtcNow));
        }
    }
}
