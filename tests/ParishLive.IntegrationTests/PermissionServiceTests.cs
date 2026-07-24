using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using ParishLive.Application.Abstractions;
using ParishLive.Domain.Constants;
using ParishLive.Infrastructure.Authorization;
using ParishLive.Infrastructure.Data;
using ParishLive.Infrastructure.Identity;
using Xunit;

namespace ParishLive.IntegrationTests;

/// <summary>Configurable RBAC: a role grants exactly the permissions configured for it.</summary>
public class PermissionServiceTests : IClassFixture<TestAppFactory>
{
    private readonly TestAppFactory _factory;
    public PermissionServiceTests(TestAppFactory factory) => _factory = factory;

    private PermissionService Service()
    {
        _ = _factory.Services;
        var options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_factory.Connection).Options;
        return new PermissionService(new AppDbContext(options, StaticTenantContext.None));
    }

    private async Task<string> IdOf(string email)
    {
        using var scope = _factory.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        return (await users.FindByEmailAsync(email))!.Id;
    }

    [Fact]
    public async Task Priest_may_approve_but_the_secretary_may_only_review()
    {
        var svc = Service();
        var priest = await IdOf(SeedIds.PriestAEmail);
        var secretary = await IdOf(SeedIds.SecretaryAEmail);

        Assert.True(await svc.HasAsync(priest, SeedIds.ParishA, PermissionCodes.Reservations.Approve));
        Assert.True(await svc.HasAsync(secretary, SeedIds.ParishA, PermissionCodes.Reservations.Review));
        Assert.False(await svc.HasAsync(secretary, SeedIds.ParishA, PermissionCodes.Reservations.Approve));
    }

    [Fact]
    public async Task A_member_can_create_but_not_manage()
    {
        var svc = Service();
        var rita = await IdOf(SeedIds.RitaEmail);

        Assert.True(await svc.HasAsync(rita, SeedIds.ParishA, PermissionCodes.Reservations.Create));
        Assert.False(await svc.HasAsync(rita, SeedIds.ParishA, PermissionCodes.Members.Manage));
    }
}
