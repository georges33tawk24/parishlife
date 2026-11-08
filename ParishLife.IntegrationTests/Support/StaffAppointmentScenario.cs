// Purpose: prepares actual isolated jurisdiction and appointment workflows for service and HTTP boundary tests.
// Main functions: CreateAsync establishes approved scope; InviteAsync, AcceptAsync, ActAsync and ActivateOfficeAsync exercise real services with explicit principals and versions.

using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Billing;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Billing;
using ParishLife.Api.Services.Organizations;

namespace ParishLife.IntegrationTests.Support;

internal class StaffAppointmentScenario(LocalBackendFixture fixture, string organization, string parish)
{
    public LocalBackendFixture Fixture { get; } = fixture;
    public string Organization { get; } = organization;
    public string Parish { get; } = parish;
    public StaffAppointmentService Service => Fixture.Services.GetRequiredService<StaffAppointmentService>();
    public IParishRepository Parishes => Fixture.Services.GetRequiredService<IParishRepository>();

    public static async Task<StaffAppointmentScenario> CreateAsync(LocalBackendFixture fixture)
    {
        var organization = await fixture.AppointedOrganizationAsync();
        var parish = await fixture.JurisdictionParishAsync(organization);
        return new StaffAppointmentScenario(fixture, organization, parish);
    }

    public async Task<StaffAppointmentDto> InviteAsync(string account, bool head = false, string[]? allows = null,
        bool admin = false, DateTimeOffset? startsAt = null, string[]? denies = null)
    {
        Fixture.As(Fixture.Nominee);
        var version = admin ? (await Parishes.GetArchdioceseAsync(Organization, default))!.Version
            : (await Parishes.GetAsync(Parish, default))!.Version;
        return await Service.InviteAsync(Organization, admin ? null : Parish, new InviteStaffAppointmentDto
        {
            OperationId = Guid.NewGuid(),
            ScopeVersion = version,
            AccountId = Guid.Parse(account),
            Role = admin ? StaffAppointmentRole.ArchdioceseAdmin : StaffAppointmentRole.Priest,
            Allows = allows ?? (admin ? ["archdiocese.read", "archdiocese.appointments.read"] : [ParishLife.Api.Models.Permissions.PeopleRead]),
            Denies = denies ?? [],
            StartsAt = startsAt ?? Fixture.Clock.Now,
            EndsAt = Fixture.Clock.Now.AddDays(20),
            AcceptBy = Fixture.Clock.Now.AddDays(1),
            ReviewDueAt = Fixture.Clock.Now.AddDays(5),
            IsHead = head,
            Reason = "Isolated staff appointment",
            EvidenceReference = "isolated staff appointment evidence",
            CurrentPassword = "isolated-fixture-long-password",
            CurrentCode = RealIdentityWorkflowTests.FixtureCode()
        }, default);
    }

    public async Task<StaffAppointmentDto> AcceptAsync(StaffAppointmentDto appointment)
    {
        Fixture.As(appointment.AccountId);
        var row = await Service.GetAsync(Organization, appointment.ParishId, appointment.Id, default);
        return await Service.DecideAsync(Organization, appointment.ParishId, appointment.Id, new DecideStaffAppointmentDto
        {
            OperationId = Guid.NewGuid(),
            Version = row.Version,
            Accept = true
        }, default);
    }

    public async Task<StaffAppointmentDto> ActAsync(StaffAppointmentDto appointment, StaffAppointmentAction action, DateTimeOffset? due = null)
    {
        Fixture.As(Fixture.Nominee);
        var row = await Service.GetAsync(Organization, appointment.ParishId, appointment.Id, default);
        return await Service.ActAsync(Organization, appointment.ParishId, appointment.Id, new ActStaffAppointmentDto
        {
            OperationId = Guid.NewGuid(),
            Version = row.Version,
            Action = action,
            ReviewDueAt = due,
            Reason = "Isolated appointment action",
            CurrentPassword = "isolated-fixture-long-password",
            CurrentCode = RealIdentityWorkflowTests.FixtureCode()
        }, default);
    }

    public async Task ActivateOfficeAsync(string[]? modules = null)
    {
        Fixture.As(Fixture.FirstAdmin);
        var billing = Fixture.Services.GetRequiredService<BillingService>();
        var plan = await billing.PublishPlanAsync(new PublishPlanDto
        {
            OperationId = Guid.NewGuid(),
            Name = "Isolated office plan",
            Amount = 1,
            Currency = "USD",
            MinorUnits = 2,
            TermMonths = 1,
            Modules = modules ?? ["core", "office"]
        }, default);
        var invoice = await billing.CreateInvoiceAsync(Parish, new CreateInvoiceDto
        {
            OperationId = Guid.NewGuid(),
            PlanId = Guid.Parse(plan.Id),
            StartsAt = Fixture.Clock.Now
        }, default);
        var row = await billing.GetAsync(Parish, invoice.Id, default);
        await billing.RecordCashAsync(Parish, invoice.Id, new RecordCashDto
        {
            OperationId = Guid.NewGuid(),
            Version = row.Invoice.Version,
            Amount = 1,
            Currency = "USD",
            ReceivedAt = Fixture.Clock.Now,
            PayerName = "Isolated payer",
            CollectedBy = "Isolated collector",
            ReceiptReference = "isolated test payment proof"
        }, default);
        Xunit.Assert.Equal(1, await Fixture.Services.GetRequiredService<CoverageActivationProcessor>().ProcessAsync("isolated-staff-test", default));
    }
}
