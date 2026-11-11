// Purpose: prepares an isolated independent parish (controlled by the fixture's Other account) plus a verified archdiocese registered by the
// first operator, and drives real plan/invoice/cash/activation services for payer-transfer and ownership-recovery tests.
// Main functions: CreateAsync, PlanAsync, InvoiceAsync, PayAsync and ActivateAsync.

using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Billing;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Billing;
using ParishLife.Api.Services.Organizations;

namespace ParishLife.IntegrationTests.Support;

internal class IndependentParishScenario(LocalBackendFixture fixture, string parish, string archdiocese, string plan)
{
    public LocalBackendFixture Fixture { get; } = fixture;
    public string Parish { get; } = parish;
    public string Archdiocese { get; } = archdiocese;
    public string Plan { get; } = plan;
    public BillingService Billing => Fixture.Services.GetRequiredService<BillingService>();
    public IParishRepository Parishes => Fixture.Services.GetRequiredService<IParishRepository>();

    public static async Task<IndependentParishScenario> CreateAsync(LocalBackendFixture f)
    {
        var archdiocese = await f.OrganizationAsync();
        f.As(f.Other);
        var service = f.Services.GetRequiredService<ParishService>();
        var parish = await service.RegisterAsync(new RegisterParishDto { OperationId = Guid.NewGuid(), Name = "Isolated independent parish", Locality = "Fixture locality", Contact = "fixture.example" }, default);
        f.As(f.FirstAdmin);
        await service.VerifyAsync(parish.Id, new VerifyParishDto
        {
            OperationId = Guid.NewGuid(), Version = (await f.Services.GetRequiredService<IParishRepository>().GetAsync(parish.Id, default))!.Version,
            EvidenceReference = "isolated representative verification"
        }, default);
        var plan = await f.Services.GetRequiredService<BillingService>().PublishPlanAsync(new PublishPlanDto
        {
            OperationId = Guid.NewGuid(), Name = "Isolated monthly plan", Amount = 10, Currency = "USD", MinorUnits = 2, TermMonths = 1, Modules = ["core"]
        }, default);
        return new IndependentParishScenario(f, parish.Id, archdiocese, plan.Id);
    }

    public Task<Invoice> InvoiceAsync(DateTimeOffset start)
    {
        Fixture.As(Fixture.Other);
        return Billing.CreateInvoiceAsync(Parish, new CreateInvoiceDto { OperationId = Guid.NewGuid(), PlanId = Guid.Parse(Plan), StartsAt = start }, default);
    }

    public async Task<CashReceipt> PayAsync(string billingAccount, string invoiceId, decimal amount = 10)
    {
        Fixture.As(Fixture.FirstAdmin);
        var summary = await Billing.InspectForOperatorAsync(billingAccount, invoiceId, default);
        return await Billing.RecordCashAsync(billingAccount, invoiceId, new RecordCashDto
        {
            OperationId = Guid.NewGuid(), Version = summary.Invoice.Version, Amount = amount, Currency = "USD", ReceivedAt = Fixture.Clock.Now,
            PayerName = "Isolated payer", CollectedBy = "Isolated collector", ReceiptReference = "isolated receipt " + Guid.NewGuid().ToString("N")
        }, default);
    }

    public Task<int> ActivateAsync() => Fixture.Services.GetRequiredService<CoverageActivationProcessor>().ProcessAsync("isolated-payer-test", default);
}
