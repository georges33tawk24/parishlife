// Purpose: verifies the platform operator's "every permission everywhere" rule (owner decision, 27 November 2026) through the real local
// services, Identity and storage.
// Main tests: a current MFA operator without any grant or coverage passes every parish permission and module check in a verified parish and
// sees it in the switcher with every permission; an ordinary account is unchanged; the same operator without the mfa claim, in a recovery
// session, or in an unverified parish is refused.

using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Organizations;
using ParishLife.Api.Services.PersonalWorkspace;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class OperatorParishAccessTests
{
    [Fact]
    public async Task A_current_mfa_operator_holds_every_parish_permission_and_module_in_verified_parishes_only()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await IndependentParishScenario.CreateAsync(f);
        var access = f.Services.GetRequiredService<IParishAccess>();
        var home = f.Services.GetRequiredService<CombinedHomeService>();

        // The second operator holds no grant and the parish has no coverage, yet every permission and module is open to him.
        f.As(f.SecondAdmin);
        foreach (var permission in Permissions.All)
            Assert.Equal(s.Parish, (await access.RequireAsync(s.Parish, permission, default)).Value.Id);
        await access.RequireModuleAsync(s.Parish, "finance", default);
        await access.RequireModuleAsync(s.Parish, "ministries", default);
        var mine = Assert.Single(await home.CapacitiesAsync(default), c => c.Kind == "PlatformOperator" && c.ParishId == s.Parish);
        Assert.Equal(Permissions.All.Order(StringComparer.Ordinal), mine.Capabilities);

        // An unverified parish stays closed to the bypass, and it is not offered in the switcher.
        f.As(f.FirstAdmin);
        var pending = await f.Services.GetRequiredService<ParishService>().RegisterAsync(new RegisterParishDto
        {
            OperationId = Guid.NewGuid(), Name = "Isolated pending parish", Locality = "Fixture locality", Contact = "fixture.example"
        }, default);
        Assert.Equal(ParishStatus.PendingVerification, pending.Status);
        f.As(f.SecondAdmin);
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => access.RequireAsync(pending.Id, Permissions.PeopleRead, default))).Kind);
        Assert.Equal("subscription_required", (await Assert.ThrowsAsync<DomainException>(() => access.RequireModuleAsync(pending.Id, "finance", default))).Code);
        Assert.DoesNotContain(await home.CapacitiesAsync(default), c => c.ParishId == pending.Id);

        // The same operator signed in without the mfa method, or in a restricted recovery session, gains nothing.
        f.As(f.SecondAdmin, mfa: false);
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => access.RequireAsync(s.Parish, Permissions.PeopleRead, default))).Kind);
        Assert.Equal("subscription_required", (await Assert.ThrowsAsync<DomainException>(() => access.RequireModuleAsync(s.Parish, "finance", default))).Code);
        f.AsRecovery(f.SecondAdmin);
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => access.RequireAsync(s.Parish, Permissions.FinanceRead, default))).Kind);
        Assert.Equal("subscription_required", (await Assert.ThrowsAsync<DomainException>(() => access.RequireModuleAsync(s.Parish, "finance", default))).Code);
    }

    [Fact]
    public async Task An_ordinary_account_is_unchanged_and_sees_no_operator_capacities()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await IndependentParishScenario.CreateAsync(f);
        var access = f.Services.GetRequiredService<IParishAccess>();

        f.As(f.Nominee);
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => access.RequireAsync(s.Parish, Permissions.PeopleRead, default))).Kind);
        Assert.Equal("subscription_required", (await Assert.ThrowsAsync<DomainException>(() => access.RequireModuleAsync(s.Parish, "finance", default))).Code);
        Assert.DoesNotContain(await f.Services.GetRequiredService<CombinedHomeService>().CapacitiesAsync(default), c => c.Kind == "PlatformOperator");

        // The parish's controller keeps exactly its grant: it was never widened by the operator rule.
        f.As(f.Other);
        await access.RequireAsync(s.Parish, Permissions.PeopleRead, default);
        Assert.Equal("subscription_required", (await Assert.ThrowsAsync<DomainException>(() => access.RequireModuleAsync(s.Parish, "finance", default))).Code);
    }
}
