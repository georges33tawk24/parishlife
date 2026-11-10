// Purpose: verifies the jurisdiction bishop's parish suspension, reinstatement and closure (O05) through real local services and storage.
// Main tests: only the bishop changes status; suspension blocks ordinary parish operations until reinstated; closure is final here; history stays.

using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Organizations;
using ParishLife.Api.Services.People;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class ParishStatusTests
{
    [Fact]
    public async Task Bishop_suspends_reinstates_and_closes_while_access_follows_and_history_stays()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        await staff.ActivateOfficeAsync(["core", "office"]);
        var office = await staff.AcceptAsync(await staff.InviteAsync(f.Other, allows: [Permissions.PeopleRead]));
        var status = f.Services.GetRequiredService<ParishStatusService>();
        var people = f.Services.GetRequiredService<PeopleService>();

        f.AsAppointment(f.Other, office.Id);
        await people.ListAsync(staff.Parish, 10, null, default);
        await Assert.ThrowsAsync<DomainException>(() => ChangeAsync(f, status, staff, "suspend"));

        f.As(f.Nominee);
        Assert.Equal("invalid_parish_state", (await Assert.ThrowsAsync<DomainException>(() => ChangeAsync(f, status, staff, "reinstate"))).Code);
        Assert.Equal(ParishStatus.Suspended, (await ChangeAsync(f, status, staff, "suspend")).To);
        f.AsAppointment(f.Other, office.Id);
        Assert.Equal("parish_closed", (await Assert.ThrowsAsync<DomainException>(() => people.ListAsync(staff.Parish, 10, null, default))).Code);

        f.As(f.Nominee);
        await ChangeAsync(f, status, staff, "reinstate");
        f.AsAppointment(f.Other, office.Id);
        await people.ListAsync(staff.Parish, 10, null, default);

        f.As(f.Nominee);
        Assert.Equal(ParishStatus.Closed, (await ChangeAsync(f, status, staff, "close")).To);
        Assert.Equal("invalid_parish_state", (await Assert.ThrowsAsync<DomainException>(() => ChangeAsync(f, status, staff, "reinstate"))).Code);
        Assert.Equal(["suspend", "reinstate", "close"], (await status.HistoryAsync(staff.Parish, default)).Select(h => h.Action).ToArray());
        f.AsAppointment(f.Other, office.Id);
        await Assert.ThrowsAsync<DomainException>(() => people.ListAsync(staff.Parish, 10, null, default));
    }

    private static async Task<ParishStatusChangeDto> ChangeAsync(LocalBackendFixture f, ParishStatusService status, StaffAppointmentScenario staff, string action)
    {
        // The frozen test clock otherwise gives every change the same instant, and history is ordered by time.
        f.Clock.Now = f.Clock.Now.AddMinutes(1);
        return await status.ChangeAsync(staff.Parish, new ParishStatusActionDto
        {
            OperationId = Guid.NewGuid(), Version = (await staff.Parishes.GetAsync(staff.Parish, default))!.Version, Action = action, Reason = "Isolated bishop decision"
        }, default);
    }
}
