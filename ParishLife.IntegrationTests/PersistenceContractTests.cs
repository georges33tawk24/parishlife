// Purpose: Isolated verification/support for PersistenceContractTests; fixtures and test-only code are excluded
// from the API deployment.
// Main functions: The_real_service_graph_resolves_without_provisioning_or_cloud_calls,
// A_password_change_invalidates_an_earlier_mfa_challenge_before_persistence,
// Authenticator_secrets_are_protected_and_bound_to_the_exact_account,
// Production_web_and_operator_tool_share_the_key_namespace_but_not_the_credential_source,
// Cosmos_plan_model_builds_and_queries_translate_without_relational_schema,
// Production_configuration_rejects_emulator_credentials,
// Business_models_and_services_belong_to_the_single_api_assembly.

using System.Security.Cryptography;
using Azure.Core;
using Azure.Identity;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.Azure.Cosmos;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using ParishLife.Api.Configuration;
using ParishLife.Api.Data.Cosmos;
using ParishLife.Api.Extensions;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Billing;
using ParishLife.Api.Services.Organizations;
using ParishLife.Api.Services.People;
using ParishLife.Tests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public sealed class PersistenceContractTests
{
    [Fact]
    public void The_real_service_graph_resolves_without_provisioning_or_cloud_calls()
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Cosmos:Endpoint"] = "https://localhost:8081/", ["Cosmos:Database"] = "NotAccessed" }).Build();
        var environment = new HostEnvironment
        {
            EnvironmentName = Environments.Development
        };
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton<IHostEnvironment>(environment);
        services.AddSingleton<IConfiguration>(config);
        services.AddParishLifeBackend(config, environment);
        services.AddScoped<ICurrentActor>(_ => new ScenarioActor(Guid.NewGuid().ToString("N")));
        services.AddAuthentication(IdentityConstants.ApplicationScheme).AddCookie(IdentityConstants.ApplicationScheme);
        services.AddRouting();
        services.AddAuthorization();
        using var provider = services.BuildServiceProvider(new ServiceProviderOptions { ValidateOnBuild = true, ValidateScopes = true });
        using var scope = provider.CreateScope();
        Assert.NotNull(scope.ServiceProvider.GetRequiredService<ParishService>());
        Assert.NotNull(scope.ServiceProvider.GetRequiredService<BillingService>());
        Assert.NotNull(scope.ServiceProvider.GetRequiredService<PeopleService>());
        Assert.NotNull(scope.ServiceProvider.GetRequiredService<SignInManager<ParishUser>>());
        Assert.NotNull(scope.ServiceProvider.GetRequiredService<AccountSessionService>());
    }

    [Fact]
    public async Task A_password_change_invalidates_an_earlier_mfa_challenge_before_persistence()
    {
        using var client = new CosmosClient("https://localhost:8081/", new DefaultAzureCredential());
        var documents = new PartitionDocuments(client, Options.Create(new CosmosOptions()));
        var clock = new ScenarioClock();
        var sessions = new AccountSessionService(documents, clock);
        var user = new ParishUser
        {
            Id = Guid.NewGuid().ToString("N"),
            Active = true,
            EmailConfirmed = true,
            SecurityStamp = "new-security-version",
            PersistenceVersion = "stored-etag",
            TwoFactorEnabled = true
        };
        var old = new Versioned<MfaChallenge>
        {
            Value = new("challenge", user.Id, "old-security-version", clock.Now.AddMinutes(2)),
            Version = "challenge-etag"
        };
        var error = await Assert.ThrowsAsync<DomainException>(() => sessions.CreateAsync(user, default, old));
        Assert.Equal("challenge_invalid", error.Code);
    }

    [Fact]
    public async Task Authenticator_secrets_are_protected_and_bound_to_the_exact_account()
    {
        using var client = new CosmosClient("https://localhost:8081/", new DefaultAzureCredential());
        var documents = new PartitionDocuments(client, Options.Create(new CosmosOptions()));
        var protection = new EphemeralDataProtectionProvider();
        using var store = new CosmosIdentityStore(documents, TimeProvider.System, protection, new Microsoft.AspNetCore.Http.HttpContextAccessor());
        var user = new ParishUser
        {
            Id = Guid.NewGuid().ToString("N")
        };
        const string secret = "TESTONLYAUTHENTICATORKEY";
        await store.SetAuthenticatorKeyAsync(user, secret, default);
        Assert.DoesNotContain(secret, user.AuthenticatorKey!, StringComparison.Ordinal);
        Assert.Equal(secret, await store.GetAuthenticatorKeyAsync(user, default));
        var different = new ParishUser
        {
            Id = Guid.NewGuid().ToString("N"),
            AuthenticatorKey = user.AuthenticatorKey
        };
        await Assert.ThrowsAsync<CryptographicException>(() => store.GetAuthenticatorKeyAsync(different, default));
    }

    [Fact]
    public void Production_web_and_operator_tool_share_the_key_namespace_but_not_the_credential_source()
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Cosmos:Endpoint"] = "https://account.documents.azure.com/", ["Cosmos:Database"] = "ParishLife", ["Azure:ManagedIdentityClientId"] = Guid.NewGuid().ToString(), ["DataProtection:BlobUri"] = "https://account.blob.core.windows.net/data-protection/keyring.xml", ["DataProtection:KeyIdentifier"] = "https://vault.vault.azure.net/keys/parishlife-data-protection", ["DataProtection:ApplicationName"] = "ParishLife.Production" }).Build();
        var environment = new HostEnvironment
        {
            EnvironmentName = Environments.Production
        };
        var web = new ServiceCollection();
        web.AddLogging();
        web.AddParishLifeBackend(config, environment);
        var maintenance = new ServiceCollection();
        maintenance.AddLogging();
        maintenance.AddParishLifeBackend(config, environment, operatorWorkstation: true);
        using var webProvider = web.BuildServiceProvider();
        using var operatorProvider = maintenance.BuildServiceProvider();
        Assert.IsType<ManagedIdentityCredential>(webProvider.GetRequiredService<TokenCredential>());
        Assert.IsType<DefaultAzureCredential>(operatorProvider.GetRequiredService<TokenCredential>());
        Assert.Equal(webProvider.GetRequiredService<IOptions<Microsoft.AspNetCore.DataProtection.DataProtectionOptions>>().Value.ApplicationDiscriminator, operatorProvider.GetRequiredService<IOptions<Microsoft.AspNetCore.DataProtection.DataProtectionOptions>>().Value.ApplicationDiscriminator);
    }

    [Fact]
    public void Cosmos_plan_model_builds_and_queries_translate_without_relational_schema()
    {
        var options = new DbContextOptionsBuilder<PlanDbContext>().UseCosmos("https://localhost:8081/", new DefaultAzureCredential(), "NotAccessed").Options;
        using var context = new PlanDbContext(options);
        var entity = context.Model.FindEntityType(typeof(PlanDocument));
        Assert.NotNull(entity);
        Assert.Equal("Catalog", entity.GetContainer());
        Assert.Equal("partitionKey", entity.FindProperty(nameof(PlanDocument.PartitionKey))!.GetJsonPropertyName());
        var query = context.Plans.Where(p => p.PartitionKey == "plans").Take(101).ToQueryString();
        Assert.Contains("SELECT", query, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Production_configuration_rejects_emulator_credentials()
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Cosmos:Endpoint"] = "https://account.documents.azure.com/", ["Cosmos:Database"] = "ParishLife", ["Cosmos:EmulatorKey"] = "not-a-production-credential", ["Azure:ManagedIdentityClientId"] = Guid.NewGuid().ToString(), ["DataProtection:BlobUri"] = "https://account.blob.core.windows.net/data-protection/keyring.xml", ["DataProtection:KeyIdentifier"] = "https://vault.vault.azure.net/keys/parishlife-data-protection" }).Build();
        var environment = new HostEnvironment
        {
            EnvironmentName = Environments.Production
        };
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddParishLifeBackend(config, environment);
        using var provider = services.BuildServiceProvider();
        Assert.Throws<OptionsValidationException>(() => provider.GetRequiredService<IOptions<CosmosOptions>>().Value);
    }

    [Fact]
    public void Business_models_and_services_belong_to_the_single_api_assembly()
    {
        var assembly = typeof(Invoice).Assembly;
        Assert.Equal("ParishLife.Api", assembly.GetName().Name);
        Assert.Same(assembly, typeof(ParishService).Assembly);
        var references = assembly.GetReferencedAssemblies().Select(reference => reference.Name).ToArray();
        Assert.DoesNotContain("ParishLife.Application", references);
        Assert.DoesNotContain("ParishLife.Domain", references);
        Assert.DoesNotContain("ParishLife.Infrastructure", references);
    }

    private sealed class HostEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = "";
        public string ApplicationName { get; set; } = "ParishLife";
        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
        public Microsoft.Extensions.FileProviders.IFileProvider ContentRootFileProvider { get; set; } = new Microsoft.Extensions.FileProviders.NullFileProvider();
    }
}
