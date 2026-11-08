// Purpose: builds the actual backend/Identity/local persistence graph in a unique isolated test directory.
// Main functions: InitializeAsync creates private test identities, As selects the test principal, OrganizationAsync verifies a synthetic organization,
// ProposeAsync, ReviewAsync, AppointedOrganizationAsync and JurisdictionParishAsync prepare real workflows; AsAppointment selects capacity;
// DisposeAsync removes only the verified temporary fixture directory.

using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using ParishLife.Api.Authorization;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.Extensions;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Services.Organizations;
using ParishLife.Tests.Support;
using Xunit;

namespace ParishLife.IntegrationTests.Support;

internal class LocalBackendFixture : IAsyncDisposable
{
    private readonly string directory = Path.Combine(Path.GetTempPath(), "ParishLife-Appointments-" + Guid.NewGuid().ToString("N"));
    private readonly ServiceProvider provider;
    private readonly AsyncServiceScope scope;

    public ScenarioClock Clock { get; } = new();

    public string FirstAdmin { get; private set; } = string.Empty;

    public string SecondAdmin { get; private set; } = string.Empty;

    public string Nominee { get; private set; } = string.Empty;

    public string Other { get; private set; } = string.Empty;

    public IServiceProvider Services => scope.ServiceProvider;

    public string DirectoryPath => directory;

    public LocalBackendFixture()
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Storage:Provider"] = "Local",
            ["Storage:LocalPath"] = directory,
            ["BackgroundJobs:Enabled"] = "false"
        }).Build();
        var environment = new FixtureEnvironment { ContentRootPath = directory };
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton<IConfiguration>(configuration);
        services.AddSingleton<IHostEnvironment>(environment);
        services.AddParishLifeBackend(configuration, environment);
        services.AddSingleton<TimeProvider>(Clock);
        services.AddScoped<ICurrentActor, CurrentActor>();
        services.AddAuthentication(IdentityConstants.ApplicationScheme).AddIdentityCookies();
        services.AddRouting();
        services.AddAuthorization();
        provider = services.BuildServiceProvider(new ServiceProviderOptions { ValidateOnBuild = true, ValidateScopes = true });
        scope = provider.CreateAsyncScope();
    }

    public async Task InitializeAsync()
    {
        var bootstrap = Services.GetRequiredService<SuperAdminBootstrapService>();
        foreach (var name in SuperAdminBootstrapService.Usernames)
        {
            var user = await bootstrap.PrepareAsync(name, "isolated-fixture-long-password", "isolated identity fixture", default);
            await bootstrap.CompleteAsync(user, "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", RealIdentityWorkflowTests.FixtureCode(), default);
            if (name == "colinsleiman")
                FirstAdmin = user.Id;
            else
                SecondAdmin = user.Id;
        }
        Nominee = await CreateVerifiedFixtureAccountAsync("nominee@fixture.example");
        Other = await CreateVerifiedFixtureAccountAsync("other@fixture.example");
    }

    public Task<string> CreateVerifiedMemberAsync() => CreateVerifiedFixtureAccountAsync("member-" + Guid.NewGuid().ToString("N") + "@fixture.example", enableMfa: false);

    public Task<string> CreateVerifiedStaffAsync() => CreateVerifiedFixtureAccountAsync("staff-" + Guid.NewGuid().ToString("N") + "@fixture.example");

    private async Task<string> CreateVerifiedFixtureAccountAsync(string name, bool enableMfa = true)
    {
        var users = Services.GetRequiredService<UserManager<ParishUser>>();
        var user = new ParishUser { Id = Guid.NewGuid().ToString("N"), UserName = name, Email = name, DisplayName = "Isolated account" };
        Assert.True((await users.CreateAsync(user, "isolated-fixture-long-password")).Succeeded);
        // Identity review and authenticator enrollment are controlled test setup, never application seeds.
        user.IdentityVerified = true;
        user.ContactVerificationReference = "isolated account verification fixture";
        if (enableMfa)
            await ((IUserAuthenticatorKeyStore<ParishUser>)Services.GetRequiredService<IUserStore<ParishUser>>()).SetAuthenticatorKeyAsync(user, "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", default);
        user.TwoFactorEnabled = enableMfa;
        Assert.True((await users.UpdateAsync(user)).Succeeded);
        return user.Id;
    }

    public void As(string accountId, bool mfa = true)
    {
        var claims = new List<Claim> { new(ClaimTypes.NameIdentifier, accountId) };
        if (mfa)
            claims.Add(new Claim("amr", "mfa"));
        Services.GetRequiredService<IHttpContextAccessor>().HttpContext = new DefaultHttpContext
        {
            RequestServices = Services,
            User = new ClaimsPrincipal(new ClaimsIdentity(claims, "IsolatedFixture"))
        };
    }

    public void AsRecovery(string accountId)
    {
        As(accountId, mfa: false);
        Services.GetRequiredService<IHttpContextAccessor>().HttpContext!.User.AddIdentity(
            new ClaimsIdentity([new Claim("amr", "recovery")]));
    }

    public void AsAppointment(string accountId, string appointmentId)
    {
        As(accountId);
        Services.GetRequiredService<IHttpContextAccessor>().HttpContext!.Request.Headers["X-ParishLife-Appointment"] = appointmentId;
    }

    public async Task<string> AppointedOrganizationAsync()
    {
        var organization = await OrganizationAsync();
        var proposal = await ProposeAsync(organization);
        await ReviewAsync(organization, proposal.Id);
        As(Nominee);
        var service = Services.GetRequiredService<BishopAppointmentService>();
        var row = await service.GetAsync(organization, proposal.Id, default);
        await service.DecideAsync(organization, proposal.Id, new DecideBishopInvitationDto
        {
            OperationId = Guid.NewGuid(),
            Version = row.Version,
            Accept = true
        }, default);
        return organization;
    }

    public async Task<string> JurisdictionParishAsync(string organization)
    {
        As(FirstAdmin);
        var service = Services.GetRequiredService<ParishService>();
        var repository = Services.GetRequiredService<IParishRepository>();
        var parish = await service.RegisterAsync(new RegisterParishDto
        {
            OperationId = Guid.NewGuid(),
            Name = "Isolated parish",
            Locality = "Fixture locality",
            Contact = "fixture.example"
        }, default);
        await service.VerifyAsync(parish.Id, new VerifyParishDto
        {
            OperationId = Guid.NewGuid(),
            Version = (await repository.GetAsync(parish.Id, default))!.Version,
            EvidenceReference = "isolated representative verification"
        }, default);
        var jurisdiction = Services.GetRequiredService<ParishJurisdictionService>();
        var proposal = await jurisdiction.ProposeAsync(parish.Id, new ProposeParishJurisdictionDto
        {
            OperationId = Guid.NewGuid(),
            Version = (await repository.GetAsync(parish.Id, default))!.Version,
            ArchdioceseId = Guid.Parse(organization),
            Reason = "Isolated first jurisdiction",
            EvidenceReference = "isolated factual jurisdiction evidence"
        }, default);
        As(Nominee);
        var row = await jurisdiction.GetAsync(parish.Id, proposal.Id, default);
        await jurisdiction.DecideAsync(parish.Id, proposal.Id, new DecideParishJurisdictionDto
        {
            OperationId = Guid.NewGuid(),
            Version = row.Version,
            Accept = true,
            Reason = "Isolated bishop decision",
            CurrentPassword = "isolated-fixture-long-password",
            CurrentCode = RealIdentityWorkflowTests.FixtureCode()
        }, default);
        return parish.Id;
    }

    public async Task<string> OrganizationAsync()
    {
        As(FirstAdmin);
        var parishes = Services.GetRequiredService<ParishService>();
        var organization = await parishes.RegisterArchdioceseAsync(new RegisterArchdioceseDto
        {
            OperationId = Guid.NewGuid(),
            Name = "Isolated organization",
            Locality = "Fixture locality"
        }, default);
        var row = await Services.GetRequiredService<IParishRepository>().GetArchdioceseAsync(organization.Id, default);
        await parishes.VerifyArchdioceseAsync(organization.Id, new VerifyParishDto
        {
            OperationId = Guid.NewGuid(),
            Version = row!.Version,
            EvidenceReference = "isolated organization verification"
        }, default);
        return organization.Id;
    }

    public async Task<ParishLife.Api.Models.BishopAppointment> ProposeAsync(string organization, DateTimeOffset? startsAt = null)
    {
        As(FirstAdmin);
        var row = await Services.GetRequiredService<IParishRepository>().GetArchdioceseAsync(organization, default);
        return await Services.GetRequiredService<BishopAppointmentService>().ProposeAsync(organization, new ProposeBishopAppointmentDto
        {
            OperationId = Guid.NewGuid(),
            OrganizationVersion = row!.Version,
            AccountId = Guid.Parse(Nominee),
            StartsAt = startsAt ?? Clock.Now,
            EndsAt = Clock.Now.AddDays(10),
            AcceptBy = Clock.Now.AddDays(2),
            ReviewDueAt = Clock.Now.AddDays(5),
            EvidenceReference = "isolated actual-appointment evidence fixture",
            Reason = "Isolated initial appointment"
        }, default);
    }

    public async Task ReviewAsync(string organization, string appointment, bool approve = true)
    {
        As(SecondAdmin);
        var service = Services.GetRequiredService<BishopAppointmentService>();
        var row = await service.GetAsync(organization, appointment, default);
        await service.ReviewAsync(organization, appointment, new ReviewBishopAppointmentDto
        {
            OperationId = Guid.NewGuid(),
            Version = row.Version,
            Approve = approve,
            Reason = "Isolated independent review"
        }, default);
    }

    public async ValueTask DisposeAsync()
    {
        Services.GetRequiredService<IHttpContextAccessor>().HttpContext = null;
        await scope.DisposeAsync();
        await provider.DisposeAsync();
        Assert.StartsWith(Path.GetFullPath(Path.GetTempPath()), Path.GetFullPath(directory), StringComparison.OrdinalIgnoreCase);
        Assert.StartsWith("ParishLife-Appointments-", Path.GetFileName(directory), StringComparison.Ordinal);
        if (Directory.Exists(directory))
            Directory.Delete(directory, true);
    }

    private class FixtureEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = Environments.Development;
        public string ApplicationName { get; set; } = "ParishLife.Api";
        public string ContentRootPath { get; set; } = string.Empty;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
