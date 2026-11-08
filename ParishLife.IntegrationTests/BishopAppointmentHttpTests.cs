// Purpose: verifies the complete first-bishop API flow using actual Identity cookies, MFA, CSRF, and isolated local storage.
// Main test: Operators_and_nominee_complete_the_recorded_workflow_without_frontend_or_seed_data.
// Helpers: SignInAsync performs password/TOTP authentication; CsrfAsync refreshes anti-forgery state; ReadAsync checks real HTTP results.

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.Identity;
using ParishLife.Api.Models;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class BishopAppointmentHttpTests
{
    [Fact]
    public async Task Operators_and_nominee_complete_the_recorded_workflow_without_frontend_or_seed_data()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        await using var factory = new BackendFactory(fixture.DirectoryPath);
        using var first = Client(factory);
        using var second = Client(factory);
        using var nominee = Client(factory);
        Assert.Equal(fixture.DirectoryPath, factory.Services.GetRequiredService<ParishLife.Api.Configuration.StorageOptions>().LocalPath);
        await using (var setup = factory.Services.CreateAsyncScope())
        {
            var manager = setup.ServiceProvider.GetRequiredService<UserManager<ParishUser>>();
            var existing = await manager.FindByNameAsync("colinsleiman");
            Assert.NotNull(existing);
            Assert.True(await manager.CheckPasswordAsync(existing, "isolated-fixture-long-password"));
        }
        await SignInAsync(first, "colinsleiman");
        await SignInAsync(second, "georgestawk");
        await SignInAsync(nominee, "nominee@fixture.example");

        var organization = await ReadAsync<ArchdioceseDto>(await first.PostAsJsonAsync("/api/archdioceses", new RegisterArchdioceseDto
        {
            OperationId = Guid.NewGuid(),
            Name = "Isolated HTTP organization",
            Locality = "Fixture locality"
        }));
        var verification = await ReadAsync<Versioned<ArchdioceseDto>>(await first.GetAsync($"/api/administration/archdiocese-verifications/{organization.Id}"));
        await ReadAsync<ArchdioceseDto>(await first.PostAsJsonAsync($"/api/archdioceses/{organization.Id}/verify", new VerifyParishDto
        {
            OperationId = Guid.NewGuid(),
            Version = verification.Version,
            EvidenceReference = "Isolated HTTP verification"
        }));
        verification = await ReadAsync<Versioned<ArchdioceseDto>>(await first.GetAsync($"/api/administration/archdiocese-verifications/{organization.Id}"));
        var root = $"/api/archdioceses/{organization.Id}/bishop-appointments";
        var proposal = await ReadAsync<BishopAppointmentDto>(await first.PostAsJsonAsync(root, new ProposeBishopAppointmentDto
        {
            OperationId = Guid.NewGuid(),
            OrganizationVersion = verification.Version,
            AccountId = Guid.Parse(fixture.Nominee),
            StartsAt = DateTimeOffset.UtcNow.AddMinutes(-1),
            EndsAt = DateTimeOffset.UtcNow.AddDays(10),
            AcceptBy = DateTimeOffset.UtcNow.AddDays(1),
            EvidenceReference = "Isolated HTTP appointment evidence",
            Reason = "Isolated appointment fixture"
        }));
        var invitation = await ReadAsync<Versioned<BishopAppointmentDto>>(await second.GetAsync(root + "/" + proposal.Id));
        Assert.False(invitation.Value.Effective);
        Assert.NotNull(invitation.Value.EvidenceReference);
        Assert.Equal(HttpStatusCode.BadRequest, (await second.PostAsJsonAsync(root + "/" + proposal.Id + "/review", new
        {
            operationId = Guid.NewGuid(),
            version = invitation.Version,
            reason = "An explicit decision is required"
        })).StatusCode);
        await ReadAsync<BishopAppointmentDto>(await second.PostAsJsonAsync(root + "/" + proposal.Id + "/review", new ReviewBishopAppointmentDto
        {
            OperationId = Guid.NewGuid(),
            Version = invitation.Version,
            Approve = true,
            Reason = "Independent isolated HTTP review"
        }));
        invitation = await ReadAsync<Versioned<BishopAppointmentDto>>(await nominee.GetAsync(root + "/" + proposal.Id));
        Assert.Null(invitation.Value.EvidenceReference);
        Assert.Equal("Invited", invitation.Value.Status);

        nominee.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        var decision = new DecideBishopInvitationDto { OperationId = Guid.NewGuid(), Version = invitation.Version, Accept = true };
        Assert.Equal(HttpStatusCode.BadRequest, (await nominee.PostAsJsonAsync(root + "/" + proposal.Id + "/response", decision)).StatusCode);
        await CsrfAsync(nominee);
        var accepted = await ReadAsync<BishopAppointmentDto>(await nominee.PostAsJsonAsync(root + "/" + proposal.Id + "/response", decision));
        Assert.Equal("Accepted", accepted.Status);
        Assert.True(accepted.Effective);
        Assert.Null(accepted.EvidenceReference);

        await using var scope = factory.Services.CreateAsyncScope();
        var account = await scope.ServiceProvider.GetRequiredService<IUserStore<ParishUser>>().FindByIdAsync(fixture.Nominee, default);
        Assert.False(account!.PlatformOperator);
        Assert.False(account.EmailConfirmed);
    }

    private static HttpClient Client(WebApplicationFactory<Program> factory) => factory.CreateClient(new WebApplicationFactoryClientOptions
    {
        BaseAddress = new Uri("https://localhost"),
        HandleCookies = true,
        AllowAutoRedirect = false
    });

    private static async Task SignInAsync(HttpClient client, string username)
    {
        await CsrfAsync(client);
        var pending = await ReadAsync<JsonElement>(await client.PostAsJsonAsync("/api/auth/login", new
        {
            username,
            password = "isolated-fixture-long-password"
        }));
        var challenge = pending.GetProperty("challenge");
        await ReadAsync<JsonElement>(await client.PostAsJsonAsync("/api/auth/login/mfa", new
        {
            accountId = challenge.GetProperty("accountId").GetString(),
            challenge = challenge.GetProperty("challenge").GetString(),
            code = RealIdentityWorkflowTests.FixtureCode()
        }));
        await CsrfAsync(client);
    }

    private static async Task CsrfAsync(HttpClient client)
    {
        var token = await ReadAsync<JsonElement>(await client.GetAsync("/api/auth/csrf"));
        client.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        client.DefaultRequestHeaders.Add("X-CSRF-TOKEN", token.GetProperty("token").GetString());
    }

    private static async Task<T> ReadAsync<T>(HttpResponseMessage response)
    {
        Assert.True(response.IsSuccessStatusCode, $"{response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        return (await response.Content.ReadFromJsonAsync<T>())!;
    }

    private class BackendFactory(string directory) : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");
            builder.ConfigureAppConfiguration((_, configuration) => configuration.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Storage:Provider"] = "Local",
                ["Storage:LocalPath"] = directory,
                ["BackgroundJobs:Enabled"] = "false",
                ["APPLICATIONINSIGHTS_CONNECTION_STRING"] = "",
                ["OTEL_EXPORTER_OTLP_ENDPOINT"] = ""
            }));
        }
    }
}
