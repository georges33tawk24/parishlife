// Purpose: verifies that a ParishLife super admin may act in the bishop's place for appointments (owner decision, 23 November 2026), through
// real local services, Identity and storage.
// Main tests: a super admin appoints a priest at a church under a verified archdiocese with no bishop and hands him control, while an ordinary
// account cannot; a super admin names a ministry leader without being the priest.

using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Organizations;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class SuperAdminAppointmentTests
{
    [Fact]
    public async Task A_super_admin_appoints_a_priest_without_a_bishop_and_hands_him_control()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var archdiocese = await f.OrganizationAsync();
        f.As(f.FirstAdmin);
        var church = await f.Services.GetRequiredService<ParishService>().RegisterAsync(new RegisterParishDto
        {
            OperationId = Guid.NewGuid(), Name = "Isolated church", Locality = "Fixture locality", Contact = "fixture.example", ArchdioceseId = Guid.Parse(archdiocese)
        }, default);
        var priest = await f.CreateVerifiedStaffAsync();
        var repository = f.Services.GetRequiredService<IParishRepository>();
        var appointments = f.Services.GetRequiredService<StaffAppointmentService>();
        async Task<InviteStaffAppointmentDto> InviteAsync() => new()
        {
            OperationId = Guid.NewGuid(), ScopeVersion = (await repository.GetAsync(church.Id, default))!.Version, AccountId = Guid.Parse(priest),
            Role = StaffAppointmentRole.Priest, Allows = [Permissions.PeopleRead], Denies = [], StartsAt = f.Clock.Now, EndsAt = f.Clock.Now.AddDays(20),
            AcceptBy = f.Clock.Now.AddDays(1), ReviewDueAt = f.Clock.Now.AddDays(5), IsHead = true, Reason = "Isolated priest appointment",
            EvidenceReference = "isolated appointment evidence", CurrentPassword = "isolated-fixture-long-password", CurrentCode = RealIdentityWorkflowTests.FixtureCode()
        };

        // An ordinary account is neither the bishop nor a super admin.
        f.As(f.Other);
        await Assert.ThrowsAsync<DomainException>(async () => await appointments.InviteAsync(archdiocese, church.Id, await InviteAsync(), default));

        f.As(f.FirstAdmin);
        var invited = await appointments.InviteAsync(archdiocese, church.Id, await InviteAsync(), default);
        f.As(priest);
        var row = await appointments.GetAsync(archdiocese, church.Id, invited.Id, default);
        await appointments.DecideAsync(archdiocese, church.Id, invited.Id, new DecideStaffAppointmentDto { OperationId = Guid.NewGuid(), Version = row.Version, Accept = true }, default);

        // He is now the church's priest, so control can be handed to him.
        f.As(f.FirstAdmin);
        var name = (await f.Services.GetRequiredService<UserManager<ParishUser>>().FindByIdAsync(priest))!.Email!;
        var handed = await f.Services.GetRequiredService<ParishControlService>().HandOverAsync(church.Id, new HandOverParishControlDto
        {
            OperationId = Guid.NewGuid(), Version = (await repository.GetAsync(church.Id, default))!.Version, Account = name
        }, default);
        Assert.Equal(priest, handed.OwnerAccountId);
    }

    [Fact]
    public async Task A_super_admin_names_a_ministry_leader()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await MinistryLeadershipScenario.CreateAsync(f);
        s.UsePriest();
        var request = await s.RequestAsync(await f.CreateVerifiedStaffAsync());
        f.As(f.FirstAdmin);
        Assert.NotNull(await s.Service.AppointAsync(s.Parish, s.Ministry, request, default));
    }
}
