// Purpose: prepares isolated current clergy authority and an explicit synthetic ministry for leadership integration checks.
// Main functions: CreateAsync, UsePriest, RequestAsync and AppointAsync exercise actual appointment, coverage and leadership services.

using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Ministries;

namespace ParishLife.IntegrationTests.Support;

internal class MinistryLeadershipScenario(LocalBackendFixture fixture, StaffAppointmentScenario staff, string ministry,
    string priest, StaffAppointmentDto appointment)
{
    public LocalBackendFixture Fixture { get; } = fixture;
    public StaffAppointmentScenario Staff { get; } = staff;
    public string Parish => Staff.Parish;
    public string Ministry { get; } = ministry;
    public string Priest { get; } = priest;
    public StaffAppointmentDto Appointment { get; } = appointment;
    public IRecordTransactions Records => Fixture.Services.GetRequiredService<IRecordTransactions>();
    public RecordScope Scope => new() { Area = RecordArea.Parish, OwnerId = Parish };
    public MinistryLeadershipService Service => ActivatorUtilities.CreateInstance<MinistryLeadershipService>(Fixture.Services);

    public static async Task<MinistryLeadershipScenario> CreateAsync(LocalBackendFixture fixture)
    {
        var staff = await StaffAppointmentScenario.CreateAsync(fixture);
        await staff.ActivateOfficeAsync(["core", "office", "ministries"]);
        var priest = await fixture.CreateVerifiedStaffAsync();
        var appointment = await staff.AcceptAsync(await staff.InviteAsync(priest, allows: [Permissions.MinistriesManage]));
        var ministry = Guid.NewGuid().ToString("N");
        var result = new MinistryLeadershipScenario(fixture, staff, ministry, priest, appointment);
        result.UsePriest();
        var operation = Operation.Create(Guid.NewGuid(), priest, new { ministry }, fixture.Clock);
        await result.Records.CommitAsync(result.Scope, operation, "fixture.ministry", ministry,
            [RecordChange.Create("ministry:" + ministry, "ministry", new Ministry
            {
                Id = ministry, ParishId = result.Parish, Name = "Isolated ministry", Kind = "Ministry",
                Purpose = "Isolated leadership workflow fixture", Status = "Active", CreatedBy = priest, CreatedAt = fixture.Clock.Now
            })], new CommandResult { Id = ministry, Status = "Fixture" }, default);
        return result;
    }

    public void UsePriest() => Fixture.AsAppointment(Priest, Appointment.Id);

    public async Task<AppointLeaderDto> RequestAsync(string account, string role = "Leader", DateTimeOffset? startsAt = null)
    {
        return new AppointLeaderDto
        {
            OperationId = Guid.NewGuid(),
            MinistryVersion = (await Records.ReadAsync<Ministry>(Scope, "ministry:" + Ministry, default))!.Version,
            AccountId = Guid.Parse(account), Role = role, StartsAt = startsAt ?? Fixture.Clock.Now,
            EndsAt = Fixture.Clock.Now.AddDays(10), EvidenceReference = "Isolated confidential appointment evidence"
        };
    }

    public async Task<MinistryLeaderDto> AppointAsync(string account, string role = "Leader")
    {
        UsePriest();
        return await Service.AppointAsync(Parish, Ministry, await RequestAsync(account, role), default);
    }
}
