// Purpose: verifies who may register a church and how its control reaches the priest (owner decision, 23 November 2026), through real local
// services, Identity and storage.
// Main tests: an ordinary verified account cannot register; the bishop registers under his own archdiocese only, the church is verified and
// placed under it, and his access excludes personal records; control goes only to a priest appointed to that parish, after which the bishop's
// grant is revoked; a parish without an archdiocese is handed over by an operator only.

using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Organizations;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class ParishControlTests
{
    private static RegisterParishDto Church(string? archdiocese) => new()
    {
        OperationId = Guid.NewGuid(), Name = "Isolated church", Locality = "Fixture locality", Contact = "fixture.example",
        ArchdioceseId = archdiocese is null ? null : Guid.Parse(archdiocese)
    };

    private static async Task<ParishDto> HandOverAsync(LocalBackendFixture f, string parish, string account)
    {
        var name = (await f.Services.GetRequiredService<UserManager<ParishUser>>().FindByIdAsync(account))!.UserName!;
        return await f.Services.GetRequiredService<ParishControlService>().HandOverAsync(parish, new HandOverParishControlDto
        {
            OperationId = Guid.NewGuid(), Version = (await f.Services.GetRequiredService<IParishRepository>().GetAsync(parish, default))!.Version, Account = name
        }, default);
    }

    [Fact]
    public async Task Only_operators_and_the_bishop_register_churches_and_the_bishop_sees_no_personal_records()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var parishes = f.Services.GetRequiredService<ParishService>();
        var access = f.Services.GetRequiredService<IParishAccess>();
        var archdiocese = await f.AppointedOrganizationAsync();
        var otherArchdiocese = await f.OrganizationAsync();

        f.As(f.Other);
        Assert.Equal("church_authority_required", (await Assert.ThrowsAsync<DomainException>(() => parishes.RegisterAsync(Church(null), default))).Code);
        Assert.Equal("church_authority_required", (await Assert.ThrowsAsync<DomainException>(() => parishes.RegisterAsync(Church(archdiocese), default))).Code);

        // The bishop registers only under his own archdiocese.
        f.As(f.Nominee);
        Assert.Equal("church_authority_required", (await Assert.ThrowsAsync<DomainException>(() => parishes.RegisterAsync(Church(null), default))).Code);
        Assert.Equal("church_authority_required", (await Assert.ThrowsAsync<DomainException>(() => parishes.RegisterAsync(Church(otherArchdiocese), default))).Code);
        var church = await parishes.RegisterAsync(Church(archdiocese), default);
        Assert.Equal((ParishStatus.Verified, archdiocese), (church.Status, church.JurisdictionArchdioceseId));
        await access.RequireAsync(church.Id, Permissions.ParishManage, default);
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => access.RequireAsync(church.Id, Permissions.PeopleRead, default))).Kind);
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => access.RequireAsync(church.Id, Permissions.FinanceRead, default))).Kind);

        // An operator may register with or without an archdiocese.
        f.As(f.FirstAdmin);
        Assert.Equal(ParishStatus.PendingVerification, (await parishes.RegisterAsync(Church(null), default)).Status);
        Assert.Equal(archdiocese, (await parishes.RegisterAsync(Church(archdiocese), default)).JurisdictionArchdioceseId);
    }

    [Fact]
    public async Task Control_goes_only_to_a_priest_appointed_to_the_parish_and_the_bishop_keeps_no_grant()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await StaffAppointmentScenario.CreateAsync(f);
        var priest = await f.CreateVerifiedStaffAsync();
        var access = f.Services.GetRequiredService<IParishAccess>();
        f.As(f.Nominee);
        var church = await f.Services.GetRequiredService<ParishService>().RegisterAsync(Church(s.Organization), default);

        // Not a priest of this parish yet.
        f.As(f.Nominee);
        Assert.Equal("priest_required", (await Assert.ThrowsAsync<DomainException>(() => HandOverAsync(f, church.Id, priest))).Code);
        // Strangers cannot hand control over.
        f.As(f.Other);
        Assert.Equal("church_authority_required", (await Assert.ThrowsAsync<DomainException>(() => HandOverAsync(f, church.Id, priest))).Code);

        var appointment = await new StaffAppointmentScenario(f, s.Organization, church.Id).InviteAsync(priest, head: true);
        await new StaffAppointmentScenario(f, s.Organization, church.Id).AcceptAsync(appointment);
        f.As(f.Nominee);
        Assert.Equal(priest, (await HandOverAsync(f, church.Id, priest)).OwnerAccountId);
        Assert.Equal("already_in_control", (await Assert.ThrowsAsync<DomainException>(() => HandOverAsync(f, church.Id, priest))).Code);

        // The priest now controls the parish with its records; the bishop's registration grant is revoked.
        f.As(priest);
        await access.RequireAsync(church.Id, Permissions.PeopleWrite, default);
        f.As(f.Nominee);
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => access.RequireAsync(church.Id, Permissions.ParishManage, default))).Kind);
    }

    [Fact]
    public async Task A_parish_without_an_archdiocese_is_handed_over_by_an_operator_only()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await IndependentParishScenario.CreateAsync(f);
        Assert.Equal(f.Other, (await s.Parishes.GetAsync(s.Parish, default))!.Value.OwnerAccountId);
        var next = await f.CreateVerifiedStaffAsync();
        f.As(f.Other);
        Assert.Equal("church_authority_required", (await Assert.ThrowsAsync<DomainException>(() => HandOverAsync(f, s.Parish, next))).Code);
        f.As(f.SecondAdmin);
        Assert.Equal(next, (await HandOverAsync(f, s.Parish, next)).OwnerAccountId);
        f.As(f.Other);
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => f.Services.GetRequiredService<IParishAccess>().RequireAsync(s.Parish, Permissions.BillingRead, default))).Kind);
    }

    [Fact]
    public async Task The_controller_grants_office_access_by_email_and_both_find_the_parish_without_following_it()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await IndependentParishScenario.CreateAsync(f);
        var secretary = await f.CreateVerifiedStaffAsync();
        var email = (await f.Services.GetRequiredService<UserManager<ParishUser>>().FindByIdAsync(secretary))!.Email!;
        var parishes = f.Services.GetRequiredService<ParishService>();
        GrantAccessDto Grant(string account) => new()
        {
            OperationId = Guid.NewGuid(), Version = s.Parishes.GetAsync(s.Parish, default).Result!.Version, Account = account,
            Allows = [Permissions.PeopleRead], Denies = [], StartsAt = f.Clock.Now
        };
        f.As(f.Other);
        Assert.Equal("account_unavailable", (await Assert.ThrowsAsync<DomainException>(() => parishes.GrantAsync(s.Parish, Grant("nobody@fixture.example"), default))).Code);
        await parishes.GrantAsync(s.Parish, Grant(email.ToUpperInvariant()), default);
        f.As(secretary);
        await f.Services.GetRequiredService<IParishAccess>().RequireAsync(s.Parish, Permissions.PeopleRead, default);
        // Neither follows the parish, yet both find it in their capacities (the parish switcher).
        var home = f.Services.GetRequiredService<ParishLife.Api.Services.PersonalWorkspace.CombinedHomeService>();
        Assert.Contains(await home.CapacitiesAsync(default), c => c.Kind == "ParishGrant" && c.ParishId == s.Parish);
        f.As(f.Other);
        Assert.Contains(await home.CapacitiesAsync(default), c => c.Kind == "ParishGrant" && c.ParishId == s.Parish);
    }
}
