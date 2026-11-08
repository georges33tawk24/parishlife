// Purpose: Isolated verification/support for HttpWorkflowTests; fixtures and test-only code are excluded from the
// API deployment.
// Main functions: Read, Csrf, Protected_endpoints_require_authentication_and_liveness_exposes_no_data,
// State_changes_require_a_matching_antiforgery_token, Another_parish_user_gets_no_existence_or_billing_details,
// Production_operator_authority_requires_current_account_flag_and_mfa_claim,
// Cash_payment_to_paid_coverage_and_people_is_a_real_http_service_flow.

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Billing;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Billing;
using Xunit;

namespace ParishLife.IntegrationTests;

public sealed class HttpWorkflowTests
{
    [Fact]
    public async Task Invalid_dtos_are_rejected_before_any_parish_write_or_account_lookup()
    {
        await using var factory = new ApiFactory();
        using var client = factory.Client(Guid.NewGuid().ToString("N"));
        await Csrf(client);

        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/parishes", new
        {
            operationId = Guid.Empty,
            name = "Isolated fixture",
            locality = "Fixture locality",
            contact = "Fixture office"
        })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/parishes", new
        {
            operationId = Guid.NewGuid(),
            name = new string('x', 501),
            locality = "Fixture locality",
            contact = "Fixture office"
        })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/parishes", new { operationId = Guid.NewGuid() })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/auth/login", new
        {
            username = "fixture-user",
            email = "fixture@example.test",
            password = "fixture-private-password"
        })).StatusCode);
        Assert.Equal(0, factory.Store.ParishCount);
    }

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters =
        {
            new JsonStringEnumConverter()
        }
    };
    private static async Task<T> Read<T>(HttpResponseMessage response)
    {
        Assert.True(response.IsSuccessStatusCode, $"{response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        return (await response.Content.ReadFromJsonAsync<T>(Json))!;
    }

    private static async Task Csrf(HttpClient client)
    {
        var response = await client.GetAsync("/api/auth/csrf");
        var token = await Read<JsonElement>(response);
        client.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        client.DefaultRequestHeaders.Add("X-CSRF-TOKEN", token.GetProperty("token").GetString());
    }

    [Fact]
    public async Task Protected_endpoints_require_authentication_and_liveness_exposes_no_data()
    {
        await using var factory = new ApiFactory();
        using var client = factory.Client();
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health/live")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync($"/api/parishes/{Guid.NewGuid()}")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/openapi/v1.json")).StatusCode);
    }

    [Fact]
    public async Task State_changes_require_a_matching_antiforgery_token()
    {
        await using var factory = new ApiFactory();
        using var client = factory.Client(Guid.NewGuid().ToString("N"));
        var request = new RegisterParishDto
        {
            OperationId = Guid.NewGuid(),
            Name = "Parish",
            Locality = "Beirut",
            Contact = "Office",
            DeclaredArchdiocese = null
        };
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/parishes", request)).StatusCode);
        Assert.Equal(0, factory.Store.ParishCount);
        await Csrf(client);
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/api/parishes", request)).StatusCode);
        Assert.Equal(1, factory.Store.ParishCount);
    }

    [Fact]
    public async Task Another_parish_user_gets_no_existence_or_billing_details()
    {
        await using var factory = new ApiFactory();
        using var owner = factory.Client(Guid.NewGuid().ToString("N"));
        await Csrf(owner);
        var parish = await Read<Parish>(await owner.PostAsJsonAsync("/api/parishes", new RegisterParishDto { OperationId = Guid.NewGuid(), Name = "Parish", Locality = "Beirut", Contact = "Office", DeclaredArchdiocese = null }));
        using var other = factory.Client(Guid.NewGuid().ToString("N"));
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync($"/api/parishes/{parish.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync($"/api/parishes/{parish.Id}/billing/coverage")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync($"/api/parishes/{parish.Id}/people")).StatusCode);
        Assert.Equal(0, factory.Store.PeopleQueries);
    }

    [Fact]
    public async Task Production_operator_authority_requires_current_account_flag_and_mfa_claim()
    {
        await using var factory = new ApiFactory();
        using var client = factory.Client(ApiFactory.OperatorId);
        await Csrf(client);
        var plan = new PublishPlanDto
        {
            OperationId = Guid.NewGuid(),
            Name = "Office annual",
            Amount = 100m,
            Currency = "USD",
            MinorUnits = 2,
            TermMonths = 12,
            Modules = ["core", "office"]
        };
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/api/plans", plan)).StatusCode);
        client.DefaultRequestHeaders.Add("X-Scenario-Mfa", "true");
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/api/plans", plan)).StatusCode);
    }

    [Fact]
    public async Task Cash_payment_to_paid_coverage_and_people_is_a_real_http_service_flow()
    {
        await using var factory = new ApiFactory();
        using var owner = factory.Client(Guid.NewGuid().ToString("N"));
        await Csrf(owner);
        using var platform = factory.Client(ApiFactory.OperatorId, true);
        await Csrf(platform);
        var parish = await Read<Parish>(await owner.PostAsJsonAsync("/api/parishes", new RegisterParishDto { OperationId = Guid.NewGuid(), Name = "Independent parish", Locality = "Beirut", Contact = "Office", DeclaredArchdiocese = "Unregistered archdiocese" }));
        Assert.Null(parish.RegisteredArchdioceseId);
        var setup = await Read<Versioned<ParishVerificationDto>>(await platform.GetAsync($"/api/administration/parish-verifications/{parish.Id}"));
        await Read<Parish>(await platform.PostAsJsonAsync($"/api/parishes/{parish.Id}/verify", new VerifyParishDto { OperationId = Guid.NewGuid(), Version = setup.Version, EvidenceReference = "Verified real representative" }));
        var plan = await Read<PlanDefinition>(await platform.PostAsJsonAsync("/api/plans", new PublishPlanDto { OperationId = Guid.NewGuid(), Name = "Office annual", Amount = 100, Currency = "USD", MinorUnits = 2, TermMonths = 12, Modules = ["core", "office"] }));
        var invoice = await Read<Invoice>(await owner.PostAsJsonAsync($"/api/parishes/{parish.Id}/billing/invoices", new CreateInvoiceDto { OperationId = Guid.NewGuid(), PlanId = Guid.Parse(plan.Id), StartsAt = factory.Clock.Now }));
        var summary = await Read<BillingSummaryDto>(await owner.GetAsync($"/api/parishes/{parish.Id}/billing/invoices/{invoice.Id}"));
        var payment = new RecordCashDto
        {
            OperationId = Guid.NewGuid(),
            Version = summary.Invoice.Version,
            Amount = 100,
            Currency = "USD",
            ReceivedAt = factory.Clock.Now,
            PayerName = "Parish payer",
            CollectedBy = "Collector",
            ReceiptReference = "CASH-0001"
        };
        var route = $"/api/parishes/{parish.Id}/billing/invoices/{invoice.Id}/cash-receipts";
        Assert.Equal(HttpStatusCode.Forbidden, (await owner.PostAsJsonAsync(route, payment)).StatusCode);
        await Read<CashReceipt>(await platform.PostAsJsonAsync(route, payment));
        await Read<CashReceipt>(await platform.PostAsJsonAsync(route, payment));
        Assert.Equal(1, factory.Store.ReceiptCount);
        Assert.Equal(HttpStatusCode.Forbidden, (await owner.GetAsync($"/api/parishes/{parish.Id}/people")).StatusCode);
        using (var scope = factory.Services.CreateScope())
            Assert.Equal(1, await scope.ServiceProvider.GetRequiredService<CoverageActivationProcessor>().ProcessAsync("scenario-worker", default));
        var result = await owner.PostAsJsonAsync($"/api/parishes/{parish.Id}/people", new CreatePersonDto { OperationId = Guid.NewGuid(), GivenName = "Marie", FamilyName = "Example", BirthDate = null, Contact = null });
        Assert.Equal(HttpStatusCode.OK, result.StatusCode);
        var final = await Read<BillingSummaryDto>(await owner.GetAsync($"/api/parishes/{parish.Id}/billing/invoices/{invoice.Id}"));
        Assert.Equal("Paid", final.Invoice.Value.Status);
        Assert.Equal("Completed", final.ActivationStatus);
    }
}
