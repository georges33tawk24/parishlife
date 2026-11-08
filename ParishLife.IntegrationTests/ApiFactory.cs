// Purpose: Isolated verification/support for ApiFactory; fixtures and test-only code are excluded from the API
// deployment.
// Main functions: ConfigureWebHost, Client, HandleAuthenticateAsync, FindByIdAsync, GetUserIdAsync,
// GetUserNameAsync, GetNormalizedUserNameAsync, SetUserNameAsync, SetNormalizedUserNameAsync, FindByNameAsync,
// CreateAsync, UpdateAsync, DeleteAsync, Dispose.

using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Billing;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Repositories.People;
using ParishLife.Tests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public sealed class ApiFactory : WebApplicationFactory<Program>
{
    internal const string OperatorId = "11111111111111111111111111111111";
    internal readonly ScenarioClock Clock = new();
    internal readonly ScenarioStore Store;
    private readonly string dataDirectory = Path.Combine(Path.GetTempPath(), "ParishLifeScenario-" + Guid.NewGuid().ToString("N"));
    public ApiFactory()
    {
        Store = new(Clock);
        Store.VerifiedAccounts.Add(OperatorId);
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.UseContentRoot(Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../ParishLife.Api")));
        builder.ConfigureAppConfiguration((_, configuration) => configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Cosmos:Endpoint"] = "https://localhost:8081/",
            ["Cosmos:Database"] = "NotUsedByScenarioTests",
            ["Storage:Provider"] = "Local",
            ["Storage:LocalPath"] = dataDirectory,
            ["BackgroundJobs:Enabled"] = "false",
            ["APPLICATIONINSIGHTS_CONNECTION_STRING"] = "",
            ["OTEL_EXPORTER_OTLP_ENDPOINT"] = ""
        }));
        builder.ConfigureTestServices(services =>
        {
            foreach (var descriptor in services.Where(d => d.ServiceType == typeof(IHostedService) && d.ImplementationType?.Name == "BillingActivationWorker").ToArray())
                services.Remove(descriptor);
            services.AddSingleton<TimeProvider>(Clock);
            services.RemoveAll<IParishRepository>();
            services.AddSingleton<IParishRepository>(Store);
            services.RemoveAll<IBillingRepository>();
            services.AddSingleton<IBillingRepository>(Store);
            services.RemoveAll<IPlanRepository>();
            services.AddSingleton<IPlanRepository>(Store);
            services.RemoveAll<IPeopleRepository>();
            services.AddSingleton<IPeopleRepository>(Store);
            services.RemoveAll<IUserStore<ParishUser>>();
            services.AddSingleton<IUserStore<ParishUser>>(new ScenarioUserStore(Store));
            services.AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = "Scenario";
                options.DefaultChallengeScheme = "Scenario";
            }).AddScheme<AuthenticationSchemeOptions, ScenarioAuthenticationHandler>("Scenario", _ =>
            {
            });
        });
    }

    internal HttpClient Client(string? accountId = null, bool mfa = false)
    {
        var client = CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new("https://localhost"), HandleCookies = true, AllowAutoRedirect = false });
        Assert.Equal(dataDirectory, Services.GetRequiredService<ParishLife.Api.Configuration.StorageOptions>().LocalPath);
        if (accountId is not null)
        {
            Store.VerifiedAccounts.Add(accountId);
            client.DefaultRequestHeaders.Add("X-Scenario-Account", accountId);
            if (mfa)
                client.DefaultRequestHeaders.Add("X-Scenario-Mfa", "true");
        }

        return client;
    }

    public override async ValueTask DisposeAsync()
    {
        await base.DisposeAsync();
        Assert.StartsWith(Path.GetFullPath(Path.GetTempPath()), Path.GetFullPath(dataDirectory), StringComparison.OrdinalIgnoreCase);
        Assert.StartsWith("ParishLifeScenario-", Path.GetFileName(dataDirectory), StringComparison.Ordinal);
        if (Directory.Exists(dataDirectory))
            Directory.Delete(dataDirectory, true);
    }
}

internal sealed class ScenarioAuthenticationHandler(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue("X-Scenario-Account", out var id))
            return Task.FromResult(AuthenticateResult.NoResult());
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, id.ToString()),
            new(ClaimTypes.Name, "Scenario account")
        };
        if (Request.Headers["X-Scenario-Mfa"] == "true")
            claims.Add(new("amr", "mfa"));
        return Task.FromResult(AuthenticateResult.Success(new(new ClaimsPrincipal(new ClaimsIdentity(claims, Scheme.Name)), Scheme.Name)));
    }
}

internal sealed class ScenarioUserStore(ScenarioStore store) : IUserStore<ParishUser>
{
    public Task<ParishUser?> FindByIdAsync(string id, CancellationToken ct) => Task.FromResult(store.VerifiedAccounts.Contains(id) ? new ParishUser { Id = id, Active = true, EmailConfirmed = true, PlatformOperator = id == ApiFactory.OperatorId, TwoFactorEnabled = id == ApiFactory.OperatorId } : null);
    public Task<string> GetUserIdAsync(ParishUser user, CancellationToken ct) => Task.FromResult(user.Id);
    public Task<string?> GetUserNameAsync(ParishUser user, CancellationToken ct) => Task.FromResult(user.UserName);
    public Task<string?> GetNormalizedUserNameAsync(ParishUser user, CancellationToken ct) => Task.FromResult(user.NormalizedUserName);
    public Task SetUserNameAsync(ParishUser user, string? name, CancellationToken ct)
    {
        user.UserName = name;
        return Task.CompletedTask;
    }

    public Task SetNormalizedUserNameAsync(ParishUser user, string? name, CancellationToken ct)
    {
        user.NormalizedUserName = name;
        return Task.CompletedTask;
    }

    public Task<ParishUser?> FindByNameAsync(string name, CancellationToken ct) => Task.FromResult<ParishUser?>(null);
    public Task<IdentityResult> CreateAsync(ParishUser user, CancellationToken ct) => throw new NotSupportedException("The HTTP scenario double does not exercise Identity persistence.");
    public Task<IdentityResult> UpdateAsync(ParishUser user, CancellationToken ct) => throw new NotSupportedException();
    public Task<IdentityResult> DeleteAsync(ParishUser user, CancellationToken ct) => throw new NotSupportedException();
    public void Dispose()
    {
    }
}
