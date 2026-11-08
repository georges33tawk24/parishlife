// Purpose: verifies real local Identity persistence, exact admin names, MFA gating, retries, and empty business data.
// Main tests: Two_admins_have_no_fabricated_email_and_can_create_sessions, Unknown_admin_is_rejected,
// Concurrent_username_claims_have_one_active_owner, and Production_rejects_local_storage.
// TestCode creates only a test TOTP fixture; production verification uses ASP.NET Core Identity.

using System.Buffers.Binary;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using ParishLife.Api.Configuration;
using ParishLife.Api.Data.Cosmos;
using ParishLife.Api.Extensions;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using Xunit;

namespace ParishLife.UnitTests;

public sealed class IdentityBootstrapTests
{
    private const string FixturePassword = "isolated-fixture-password-only";
    private const string FixtureSecret = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    [Fact]
    public async Task Two_admins_have_no_fabricated_email_and_can_create_sessions()
    {
        await using var fixture = new IdentityFixture();
        var bootstrap = fixture.Services.GetRequiredService<SuperAdminBootstrapService>();
        var users = fixture.Services.GetRequiredService<UserManager<ParishUser>>();
        var documents = fixture.Services.GetRequiredService<PartitionDocuments>();
        var sessions = fixture.Services.GetRequiredService<AccountSessionService>();
        Assert.Empty(await documents.QueryAsync<ParishUser>(Containers.Accounts, null, StorageQuery.Type("account"), default));
        foreach (var username in SuperAdminBootstrapService.Usernames)
        {
            var prepared = await bootstrap.PrepareAsync(username, FixturePassword, "isolated fixture verification", default);
            Assert.False(prepared.PlatformOperator);
            Assert.Null(prepared.Email);
            Assert.False(prepared.EmailConfirmed);
            await Assert.ThrowsAsync<DomainException>(() => bootstrap.CompleteAsync(prepared, FixtureSecret, "invalid", default));
            Assert.False((await users.FindByNameAsync(username))!.PlatformOperator);
            await bootstrap.CompleteAsync(prepared, FixtureSecret, TestCode(), default);
            var account = (await users.FindByNameAsync(username.ToUpperInvariant()))!;
            Assert.True(account.PlatformOperator);
            Assert.True(account.TwoFactorEnabled);
            Assert.Null(account.Email);
            Assert.True(AccountVerification.IsVerified(account));
            var challenge = await sessions.CreateChallengeAsync(account, default);
            var storedChallenge = await sessions.GetChallengeAsync(account.Id, challenge.Challenge, default);
            var session = await sessions.CreateAsync(account, default, storedChallenge);
            Assert.True(await sessions.ValidAsync(account.Id, session.Id, account.SecurityStamp!, default));
            await Assert.ThrowsAsync<DomainException>(() => sessions.CreateAsync(account, default, storedChallenge));
            var repeated = await bootstrap.PrepareAsync(username, FixturePassword, "isolated fixture verification", default);
            await bootstrap.CompleteAsync(repeated, null, TestCode(), default);
            Assert.Equal(account.Id, repeated.Id);
        }

        var accounts = await documents.QueryAsync<ParishUser>(Containers.Accounts, null, StorageQuery.Type("account"), default);
        Assert.Equal(2, accounts.Count);
        Assert.Equal(SuperAdminBootstrapService.Usernames.Order(), accounts.Select(account => account.UserName).Order());
        Assert.Empty(await documents.QueryAsync<object>(Containers.TenantControl, null, StorageQuery.Type("parish"), default));
        Assert.Empty(await documents.QueryAsync<object>(Containers.Billing, null, StorageQuery.Type("invoice"), default));
        Assert.Empty(await documents.QueryAsync<object>(Containers.Catalog, null, StorageQuery.Type("plan"), default));
    }

    [Fact]
    public async Task Unknown_admin_is_rejected_before_any_account_is_created()
    {
        await using var fixture = new IdentityFixture();
        var bootstrap = fixture.Services.GetRequiredService<SuperAdminBootstrapService>();
        var error = await Assert.ThrowsAsync<DomainException>(() => bootstrap.PrepareAsync("anotheradmin", FixturePassword, "fixture", default));
        Assert.Equal("bootstrap_username_forbidden", error.Code);
        var documents = fixture.Services.GetRequiredService<PartitionDocuments>();
        Assert.Empty(await documents.QueryAsync<ParishUser>(Containers.Accounts, null, StorageQuery.Type("account"), default));
    }

    [Fact]
    public async Task Super_admin_username_does_not_confer_clergy_authority()
    {
        await using var fixture = new IdentityFixture();
        var bootstrap = fixture.Services.GetRequiredService<SuperAdminBootstrapService>();
        var user = await bootstrap.PrepareAsync("colinsleiman", FixturePassword, "isolated fixture verification", default);
        var clergy = fixture.Services.GetRequiredService<IClergyAuthority>();
        var failure = await Assert.ThrowsAsync<DomainException>(() => clergy.RequireAsync(Guid.NewGuid().ToString("N"), user.Id, "Priest", default));
        Assert.Equal("clergy_authority_required", failure.Code);
    }

    [Fact]
    public async Task Concurrent_username_claims_have_one_active_owner()
    {
        await using var fixture = new IdentityFixture();
        using var firstScope = fixture.Provider.CreateScope();
        using var secondScope = fixture.Provider.CreateScope();
        var first = new ParishUser
        {
            UserName = "isolated-username",
            LockoutEnabled = true
        };
        var second = new ParishUser
        {
            UserName = "isolated-username",
            LockoutEnabled = true
        };
        var outcomes = await Task.WhenAll(firstScope.ServiceProvider.GetRequiredService<UserManager<ParishUser>>().CreateAsync(first, FixturePassword), secondScope.ServiceProvider.GetRequiredService<UserManager<ParishUser>>().CreateAsync(second, FixturePassword));
        Assert.Single(outcomes, outcome => outcome.Succeeded);
        var users = fixture.Services.GetRequiredService<UserManager<ParishUser>>();
        var winner = await users.FindByNameAsync("isolated-username");
        Assert.NotNull(winner);
        Assert.True(winner.Active);
        Assert.False(winner.PlatformOperator);
    }

    [Fact]
    public async Task Public_registration_cannot_occupy_a_reserved_bootstrap_account_id()
    {
        await using var fixture = new IdentityFixture();
        var users = fixture.Services.GetRequiredService<UserManager<ParishUser>>();
        var result = await users.CreateAsync(new ParishUser { Id = SuperAdminBootstrapService.AccountIdFor("colinsleiman"), UserName = "isolated-collision@example.invalid", Email = "isolated-collision@example.invalid" }, FixturePassword);
        Assert.False(result.Succeeded);
        Assert.Contains(result.Errors, error => error.Code == "ReservedAccountId");
        var documents = fixture.Services.GetRequiredService<PartitionDocuments>();
        Assert.Empty(await documents.QueryAsync<ParishUser>(Containers.Accounts, null, StorageQuery.Type("account"), default));
    }

    [Fact]
    public void Production_rejects_local_storage_and_invalid_key_locations()
    {
        var services = new ServiceCollection();
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Storage:Provider"] = "Local" }).Build();
        Assert.Throws<InvalidOperationException>(() => services.AddParishLifeBackend(configuration, new TestEnvironment { EnvironmentName = Environments.Production }));
        Assert.False(AzureConfiguration.IsVersionlessKeyUri("https://vault.vault.azure.net/keys/key/version"));
        Assert.False(AzureConfiguration.IsBlobUri("https://storage.blob.core.windows.net/container/key?sig=fixture"));
        Assert.True(AzureConfiguration.IsVersionlessKeyUri("https://vault.vault.azure.net/keys/key"));
    }

    [Fact]
    public void Manual_identity_review_never_fabricates_email_confirmation_or_username_authority()
    {
        var account = new ParishUser
        {
            UserName = "isolated-fixture",
            IdentityVerified = true,
            ContactVerificationReference = "isolated manual review"
        };
        Assert.True(AccountVerification.IsVerified(account));
        Assert.False(account.EmailConfirmed);
        var claimedAdmin = new ParishUser
        {
            UserName = "colinsleiman",
            ContactVerificationReference = "unverified claim"
        };
        Assert.False(AccountVerification.IsVerified(claimedAdmin));
    }

    internal static string TestCode()
    {
        Span<byte> counter = stackalloc byte[8];
        BinaryPrimitives.WriteInt64BigEndian(counter, DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 30);
        var hash = HMACSHA1.HashData(new byte[20], counter);
        var offset = hash[^1] & 15;
        var value = BinaryPrimitives.ReadInt32BigEndian(hash.AsSpan(offset, 4)) & int.MaxValue;
        return (value % 1_000_000).ToString("D6", System.Globalization.CultureInfo.InvariantCulture);
    }

    private sealed class IdentityFixture : IAsyncDisposable
    {
        private readonly string directory = Path.Combine(Path.GetTempPath(), "ParishLife-Identity-" + Guid.NewGuid().ToString("N"));
        private readonly AsyncServiceScope scope;
        internal ServiceProvider Provider { get; }
        internal IServiceProvider Services => scope.ServiceProvider;

        internal IdentityFixture()
        {
            var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Storage:Provider"] = "Local", ["Storage:LocalPath"] = directory, ["Cosmos:Endpoint"] = "https://localhost:8081/", ["Cosmos:Database"] = "IsolatedTest" }).Build();
            var environment = new TestEnvironment
            {
                EnvironmentName = Environments.Development,
                ContentRootPath = directory
            };
            var services = new ServiceCollection();
            services.AddLogging();
            services.AddSingleton<IConfiguration>(configuration);
            services.AddSingleton<IHostEnvironment>(environment);
            services.AddSingleton<ICurrentActor, TestActor>();
            services.AddAuthentication(IdentityConstants.ApplicationScheme).AddCookie(IdentityConstants.ApplicationScheme);
            services.AddRouting();
            services.AddParishLifeBackend(configuration, environment);
            Provider = services.BuildServiceProvider(new ServiceProviderOptions { ValidateScopes = true, ValidateOnBuild = true });
            scope = Provider.CreateAsyncScope();
        }

        public async ValueTask DisposeAsync()
        {
            await scope.DisposeAsync();
            await Provider.DisposeAsync();
            if (Directory.Exists(directory))
                Directory.Delete(directory, recursive: true);
        }
    }

    private sealed class TestActor : ICurrentActor
    {
        public string AccountId => "isolated-fixture-operator";
        public string? ActingAppointmentId => null;
    }

    private sealed class TestEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = "";
        public string ApplicationName { get; set; } = "ParishLife.Api";
        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
