// Purpose: composes the single API's persistence, Azure identity, account security, and feature services.
// Main functions: AddParishLifeBackend, ReadStorage, IsLocal, RegisterStorage, RegisterIdentity, ConfigureDataProtection.

using Azure.Core;
using Microsoft.AspNetCore.Authentication;
using Azure.Identity;
using Azure.Security.KeyVault.Keys;
using Azure.Storage.Blobs;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.DataProtection.KeyManagement;
using Microsoft.AspNetCore.DataProtection.Repositories;
using Microsoft.AspNetCore.Identity;
using Microsoft.Azure.Cosmos;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using ParishLife.Api.Authorization;
using ParishLife.Api.BackgroundJobs;
using ParishLife.Api.Configuration;
using ParishLife.Api.Data.Cosmos;
using ParishLife.Api.Data.Local;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Billing;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Repositories.People;
using ParishLife.Api.Interfaces.Repositories.Scheduling;
using ParishLife.Api.Interfaces.Services.Accounts;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Repositories.Billing;
using ParishLife.Api.Repositories.Common;
using ParishLife.Api.Repositories.Organizations;
using ParishLife.Api.Repositories.People;
using ParishLife.Api.Repositories.Reporting;
using ParishLife.Api.Interfaces.Repositories.Reporting;
using ParishLife.Api.Repositories.Scheduling;
using ParishLife.Api.Services.Accounts;
using ParishLife.Api.Services.Administration;
using ParishLife.Api.Services.Billing;
using ParishLife.Api.Services.Ministries;
using ParishLife.Api.Services.Files;
using ParishLife.Api.Services.Publishing;
using ParishLife.Api.Services.Reporting;
using ParishLife.Api.Services.Registrations;
using ParishLife.Api.Services.Requests;
using ParishLife.Api.Services.Sacraments;
using ParishLife.Api.Services.Care;
using ParishLife.Api.Services.Communications;
using ParishLife.Api.Services.Finance;
using ParishLife.Api.Services.Documents;
using ParishLife.Api.Services.Operations;
using ParishLife.Api.Services.Organizations;
using ParishLife.Api.Services.People;
using ParishLife.Api.Services.PersonalWorkspace;
using ParishLife.Api.Services.Scheduling;
using ParishLife.Api.Services.Workflows;

namespace ParishLife.Api.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddParishLifeBackend(this IServiceCollection services, IConfiguration configuration, IHostEnvironment environment, bool operatorWorkstation = false)
    {
        _ = ReadStorage(configuration, environment); // Reject an already-invalid production provider immediately.
        // Resolve final host configuration when services are built, including legitimate test-host overrides.
        services.AddSingleton(_ => ReadStorage(configuration, environment));
        services.AddSingleton(TimeProvider.System);
        services.AddOptions<CosmosOptions>().Bind(configuration.GetSection("Cosmos")).Validate(o => IsLocal(ReadStorage(configuration, environment)) || AzureConfiguration.IsHttps(o.Endpoint), "Cosmos:Endpoint must be an HTTPS endpoint without embedded credentials.").Validate(o => !string.IsNullOrWhiteSpace(o.Database), "Cosmos:Database is required.").Validate(o => environment.IsDevelopment() && !operatorWorkstation || string.IsNullOrEmpty(o.EmulatorKey), "Emulator credentials are forbidden outside ordinary Development.").ValidateOnStart();
        services.AddOptions<AzureOptions>().Bind(configuration.GetSection("Azure")).Validate(o => environment.IsDevelopment() || operatorWorkstation || Guid.TryParse(o.ManagedIdentityClientId, out _), "Production requires the user-assigned managed identity client ID.").ValidateOnStart();
        services.AddOptions<BlobStorageOptions>().Bind(configuration.GetSection("BlobStorage")).Validate(o => IsLocal(ReadStorage(configuration, environment)) || AzureConfiguration.IsHttps(o.ServiceUri), "BlobStorage:ServiceUri must be an HTTPS service URI.").Validate(o => AzureConfiguration.IsContainerName(o.EvidenceContainer), "The evidence container name is invalid.").ValidateOnStart();
        services.AddOptions<Configuration.DataProtectionOptions>().Bind(configuration.GetSection("DataProtection")).Validate(o => !string.IsNullOrWhiteSpace(o.ApplicationName), "DataProtection:ApplicationName is required.").Validate(o => environment.IsDevelopment() || AzureConfiguration.IsBlobUri(o.BlobUri), "Production needs the HTTPS Data Protection Blob URI.").Validate(o => environment.IsDevelopment() || AzureConfiguration.IsVersionlessKeyUri(o.KeyIdentifier), "Production needs the versionless HTTPS Key Vault key URI.").ValidateOnStart();
        services.AddSingleton<TokenCredential>(provider =>
        {
            var azure = provider.GetRequiredService<IOptions<AzureOptions>>().Value;
            return environment.IsDevelopment() || operatorWorkstation ? new DefaultAzureCredential(new DefaultAzureCredentialOptions { ExcludeManagedIdentityCredential = true }) : new ManagedIdentityCredential(ManagedIdentityId.FromUserAssignedClientId(azure.ManagedIdentityClientId!));
        });
        RegisterStorage(services, configuration, environment);
        ConfigureDataProtection(services, environment);
        RegisterIdentity(services);
        RegisterAuthenticationCapabilities(services, configuration);
        services.AddScoped<IParishRepository, ParishRepository>();
        services.AddScoped<IBillingRepository, BillingRepository>();
        services.AddScoped<IPlanRepository>(provider => IsLocal(provider.GetRequiredService<StorageOptions>())
            ? new LocalPlanRepository(provider.GetRequiredService<PartitionDocuments>())
            : new PlanRepository(provider.GetRequiredService<PlanDbContext>()));
        services.AddScoped<IPeopleRepository, PeopleRepository>();
        services.AddScoped<IRecordTransactions, RecordTransactions>();
        services.AddScoped<IParishAccess, ParishAccess>();
        services.AddScoped<IPlatformAccess, PlatformAccess>();
        services.AddScoped<IAccountDirectory, AccountDirectory>();
        services.AddScoped<IClergyAuthority, ClergyAuthority>();
        services.AddScoped<IArchdioceseAuthority, ArchdioceseAuthority>();
        services.AddScoped<StaffAppointmentAccess>();
        services.AddScoped<IStaffAppointmentDirectory, StaffAppointmentDirectory>();
        services.AddScoped<IStaffAppointmentAccess>(provider => provider.GetRequiredService<StaffAppointmentAccess>());
        services.AddScoped<StaffAppointmentService>();
        services.AddScoped<ParishJurisdictionService>();
        services.AddScoped<BishopAppointmentService>();
        services.AddScoped<ParishService>();
        services.AddScoped<ParishStatusService>();
        services.AddScoped<OwnershipRecoveryService>();
        services.AddScoped<OfficeCoverageService>();
        services.AddScoped<BillingService>();
        services.AddScoped<PayerTransferService>();
        services.AddScoped<PeopleService>();
        services.AddScoped<HouseholdService>();
        services.AddScoped<MembershipService>();
        services.AddScoped<PersonInvitationService>();
        services.AddScoped<PeopleDirectoryService>();
        services.AddScoped<AccountNamesService>();
        services.AddScoped<PersonFactsService>();
        services.AddScoped<DuplicateService>();
        services.AddScoped<PeopleImportService>();
        services.AddScoped<PersonDataService>();
        services.AddScoped<RequestService>();
        services.AddScoped<SacramentService>();
        services.AddScoped<CertificateService>();
        services.AddScoped<ClergySignatureImageService>();
        services.AddScoped<PastoralNoteService>();
        services.AddScoped<ConcernService>();
        services.AddScoped<IncidentService>();
        services.AddScoped<CommunicationsService>();
        services.AddScoped<NotificationService>();
        services.AddScoped<NotificationAudience>();
        services.AddScoped<NotificationProcessor>();
        services.AddScoped<NotificationOutcomeReader>();
        services.AddScoped<InboxService>();
        services.AddScoped<MessageReviewService>();
        services.AddScoped<BroadcastService>();
        services.AddScoped<GivingService>();
        services.AddScoped<ExpenseService>();
        services.AddScoped<BankReconciliationService>();
        services.AddScoped<OfficeLedgerService>();
        services.AddScoped<PersonalWorkspaceService>();
        services.AddScoped<AccountProfileService>();
        services.AddScoped<IResourceAllocator, ResourceAllocator>();
        services.AddScoped<MinistryAccess>();
        services.AddScoped<MinistryService>();
        services.AddScoped<MinistryApplicationService>();
        services.AddScoped<MinistryLeadershipService>();
        services.AddScoped<MinistryPersonLinkService>();
        services.AddScoped<MinistryDepartureService>();
        services.AddScoped<MinistryMeetingService>();
        services.AddScoped<MinistryAttendanceService>();
        services.AddScoped<MinistryRsvpPrivacyService>();
        services.AddScoped<MinistryFormationService>();
        services.AddScoped<MinistryResourceService>();
        services.AddScoped<MinistryVolunteerService>();
        services.AddScoped<RegistrationService>();
        services.AddScoped<ReservationMeetingAccess>();
        services.AddScoped<CalendarService>();
        services.AddScoped<EventTemplateService>();
        services.AddScoped<ScheduleService>();
        services.AddScoped<RentalService>();
        services.AddScoped<WebsiteService>();
        services.AddScoped<ParishCrmService>();
        services.AddScoped<HomepageService>();
        services.AddScoped<PublicDirectoryService>();
        services.AddScoped<PublicAppService>();
        services.AddScoped<LiturgicalCalendarService>();
        services.AddScoped<CombinedHomeService>();
        services.AddScoped<WorkflowAccess>();
        services.AddScoped<WorkflowDefinitionService>();
        services.AddScoped<WorkflowRunService>();
        services.AddScoped<WorkOverviewService>();
        services.AddScoped<IParishDirectory, ParishDirectory>();
        services.AddScoped<ISiteMetricStore, SiteMetricStore>();
        services.AddScoped<ParishLocationService>();
        services.AddScoped<BishopOverviewService>();
        services.AddScoped<SiteInsightsService>();
        services.AddScoped<ReportScheduleService>();
        services.AddScoped<ReportScheduleProcessor>();
        services.AddScoped<CapabilityService>();
        services.AddScoped<DocumentSheetService>();
        services.AddScoped<DocumentSignatureService>();
        services.AddScoped<RequestLetterService>();
        services.AddScoped<EvidenceService>();
        services.AddScoped<ServicePlanService>();
        services.AddScoped<MusicLibraryService>();
        services.AddScoped<FacilityService>();
        services.AddScoped<EquipmentService>();
        services.AddScoped<FacilityIssueService>();
        services.AddScoped<ReservationService>();
        services.AddScoped<ReservationWorkAuthorization>();
        services.AddScoped<ReservationProcessor>();
        services.AddScoped<CoverageActivationProcessor>();
        services.AddScoped<SuperAdminBootstrapService>();
        if (!operatorWorkstation)
        {
            services.AddHostedService<BillingActivationWorker>();
            services.AddHostedService<ReservationWorker>();
            services.AddHostedService<NotificationWorker>();
            services.AddHostedService<ReportScheduleWorker>();
        }
        else
        {
            // W07: snapshot export/restore exists only in the private operator tool, never in the web host.
            services.AddScoped(provider =>
            {
                var storage = provider.GetRequiredService<StorageOptions>();
                var local = IsLocal(storage);
                var root = local ? StorageOptions.ResolveLocalPath(storage, environment) : "";
                var cosmos = provider.GetRequiredService<IOptions<CosmosOptions>>().Value;
                var blob = provider.GetRequiredService<IOptions<BlobStorageOptions>>().Value;
                return new DataSnapshotService(provider.GetRequiredService<IDocumentDatabase>(), provider.GetRequiredService<IEvidenceStore>(),
                    local ? "Local:" + Path.Combine(root, "documents") : "Cosmos:" + cosmos.Endpoint.TrimEnd('/').ToLowerInvariant() + "/" + cosmos.Database,
                    local ? "Local:" + Path.Combine(root, "evidence") : "Blob:" + blob.ServiceUri.TrimEnd('/').ToLowerInvariant() + "/" + blob.EvidenceContainer,
                    local, provider.GetRequiredService<TimeProvider>());
            });
        }
        services.AddHealthChecks().AddCheck<BackendReadinessHealthCheck>("backend_dependencies", tags: ["ready"]);
        return services;
    }

    private static bool IsLocal(StorageOptions options) => string.Equals(options.Provider, "Local", StringComparison.OrdinalIgnoreCase);

    private static StorageOptions ReadStorage(IConfiguration configuration, IHostEnvironment environment)
    {
        var storage = configuration.GetSection("Storage").Get<StorageOptions>() ?? new();
        if (!IsLocal(storage) && !string.Equals(storage.Provider, "Cosmos", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Storage:Provider must be Local or Cosmos.");
        if (IsLocal(storage) && !environment.IsDevelopment())
            throw new InvalidOperationException("Local document storage is permitted only in Development.");
        return storage;
    }

    private static void RegisterStorage(IServiceCollection services, IConfiguration configuration, IHostEnvironment environment)
    {
        services.AddSingleton(provider =>
        {
            var cosmos = provider.GetRequiredService<IOptions<CosmosOptions>>().Value;
            var options = new CosmosClientOptions
            {
                ApplicationName = "ParishLife",
                ConsistencyLevel = ConsistencyLevel.Strong,
                UseSystemTextJsonSerializerWithOptions = JsonDefaults.Options,
                MaxRetryAttemptsOnRateLimitedRequests = 5,
                MaxRetryWaitTimeOnRateLimitedRequests = TimeSpan.FromSeconds(10)
            };
            return environment.IsDevelopment() && !string.IsNullOrWhiteSpace(cosmos.EmulatorKey) ? new CosmosClient(cosmos.Endpoint, cosmos.EmulatorKey, options) : new CosmosClient(cosmos.Endpoint, provider.GetRequiredService<TokenCredential>(), options);
        });
        services.AddDbContext<PlanDbContext>((provider, builder) =>
        {
            var options = provider.GetRequiredService<IOptions<CosmosOptions>>().Value;
            if (environment.IsDevelopment() && !string.IsNullOrWhiteSpace(options.EmulatorKey))
                builder.UseCosmos(options.Endpoint, options.EmulatorKey, options.Database);
            else
                builder.UseCosmos(options.Endpoint, provider.GetRequiredService<TokenCredential>(), options.Database);
        });
        services.AddSingleton<IDocumentDatabase>(provider => IsLocal(provider.GetRequiredService<StorageOptions>())
            ? new LocalDocumentDatabase(StorageOptions.ResolveLocalPath(provider.GetRequiredService<StorageOptions>(), environment))
            : new CosmosDocumentDatabase(provider.GetRequiredService<CosmosClient>(), provider.GetRequiredService<IOptions<CosmosOptions>>().Value.Database));
        services.AddScoped(provider => new PartitionDocuments(provider.GetRequiredService<IDocumentDatabase>()));
        services.AddSingleton<IEvidenceStore>(provider => IsLocal(provider.GetRequiredService<StorageOptions>())
            ? new Data.Local.LocalEvidenceStore(StorageOptions.ResolveLocalPath(provider.GetRequiredService<StorageOptions>(), environment))
            : new Data.Blob.BlobEvidenceStore(provider.GetRequiredService<BlobServiceClient>().GetBlobContainerClient(provider.GetRequiredService<IOptions<BlobStorageOptions>>().Value.EvidenceContainer)));
        services.AddSingleton(provider => new BlobServiceClient(new Uri(provider.GetRequiredService<IOptions<BlobStorageOptions>>().Value.ServiceUri), provider.GetRequiredService<TokenCredential>()));
        services.AddSingleton(provider =>
        {
            var key = new Uri(provider.GetRequiredService<IOptions<Configuration.DataProtectionOptions>>().Value.KeyIdentifier);
            return new KeyClient(new Uri(key.GetLeftPart(UriPartial.Authority)), provider.GetRequiredService<TokenCredential>());
        });
        services.AddSingleton(provider =>
        {
            var storage = provider.GetRequiredService<StorageOptions>();
            var local = IsLocal(storage);
            return new InfrastructureReadiness(local ? null : provider.GetRequiredService<CosmosClient>(), provider.GetRequiredService<IOptions<CosmosOptions>>(),
                local ? StorageOptions.ResolveLocalPath(storage, environment) : null,
                local ? null : provider.GetRequiredService<BlobServiceClient>(), local ? null : provider.GetRequiredService<KeyClient>(),
                provider.GetRequiredService<IOptions<BlobStorageOptions>>(), provider.GetRequiredService<IOptions<Configuration.DataProtectionOptions>>(), configuration);
        });
    }

    private static void RegisterIdentity(IServiceCollection services)
    {
        services.AddHttpContextAccessor();
        services.AddIdentityCore<ParishUser>(options =>
        {
            options.User.RequireUniqueEmail = false; // Username-only bootstrap accounts have no fabricated email.
            options.User.AllowedUserNameCharacters = string.Empty;
            options.Password.RequiredLength = 16;
            options.Password.RequireDigit = false;
            options.Password.RequireLowercase = false;
            options.Password.RequireUppercase = false;
            options.Password.RequireNonAlphanumeric = false;
            options.SignIn.RequireConfirmedAccount = true;
            options.Lockout.AllowedForNewUsers = true;
            options.Lockout.MaxFailedAccessAttempts = 5;
            options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
        }).AddUserStore<CosmosIdentityStore>().AddUserManager<ParishUserManager>().AddSignInManager()
            .AddUserConfirmation<VerifiedAccountConfirmation>().AddTokenProvider<DataProtectorTokenProvider<ParishUser>>(TokenOptions.DefaultProvider)
            .AddTokenProvider<AuthenticatorTokenProvider<ParishUser>>(TokenOptions.DefaultAuthenticatorProvider);
        services.AddScoped<AccountService>();
        services.AddScoped<AccountPasswordService>();
        services.AddScoped<AccountCookieService>();
        services.AddScoped<MfaAccountAccess>();
        services.AddScoped<MfaRecoveryService>();
        services.AddScoped<MfaSecurityService>();
        services.AddScoped(provider => new AccountSessionService(provider.GetRequiredService<PartitionDocuments>(), provider.GetRequiredService<TimeProvider>()));
    }

    // X01/A06/X13: passkeys, contact verification, optional external sign-in and optional Turnstile; nothing calls out unless configured.
    private static void RegisterAuthenticationCapabilities(IServiceCollection services, IConfiguration configuration)
    {
        services.AddScoped<IPasskeyHandler<ParishUser>, PasskeyHandler<ParishUser>>();
        services.Configure<IdentityPasskeyOptions>(options =>
        {
            options.ServerDomain = string.IsNullOrWhiteSpace(configuration["Passkeys:ServerDomain"]) ? null : configuration["Passkeys:ServerDomain"];
            options.UserVerificationRequirement = "required";
        });
        services.AddScoped<PasskeyService>();
        services.AddOptions<TurnstileOptions>().Bind(configuration.GetSection("Turnstile"));
        services.AddHttpClient(TurnstileVerifier.ClientName, client => client.Timeout = TimeSpan.FromSeconds(10));
        services.AddScoped<TurnstileVerifier>();
        services.AddScoped<IContactCodeDelivery, UnconfiguredContactCodeDelivery>();
        services.AddScoped<ContactVerificationService>();
        services.AddScoped<ExternalSignInService>();
        foreach (var (provider, endpoints) in ExternalProviderOptions.Providers)
        {
            var settings = configuration.GetSection("ExternalSignIn:" + provider).Get<ExternalProviderOptions>() ?? new();
            if (!settings.Configured)
                continue; // An unconfigured provider has no scheme, so capability reports it unavailable and its routes return 404.
            services.AddAuthentication().AddOAuth(ExternalProviderOptions.SchemePrefix + provider, options =>
            {
                options.ClientId = settings.ClientId!;
                options.ClientSecret = settings.ClientSecret!;
                options.AuthorizationEndpoint = endpoints[0];
                options.TokenEndpoint = endpoints[1];
                options.UserInformationEndpoint = endpoints[2];
                options.CallbackPath = "/api/auth/external/callback/" + provider;
                options.SignInScheme = IdentityConstants.ExternalScheme;
                options.UsePkce = true;
                options.Scope.Add("openid");
                options.ClaimActions.MapJsonKey(System.Security.Claims.ClaimTypes.NameIdentifier, "sub");
                options.Events.OnCreatingTicket = async context =>
                {
                    using var request = new HttpRequestMessage(HttpMethod.Get, context.Options.UserInformationEndpoint);
                    request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", context.AccessToken);
                    using var response = await context.Backchannel.SendAsync(request, context.HttpContext.RequestAborted);
                    response.EnsureSuccessStatusCode();
                    using var user = System.Text.Json.JsonDocument.Parse(await response.Content.ReadAsStringAsync(context.HttpContext.RequestAborted));
                    context.RunClaimActions(user.RootElement); // Only the stable subject is mapped; provider email is never trusted or merged.
                };
            });
        }
    }

    private static void ConfigureDataProtection(IServiceCollection services, IHostEnvironment environment)
    {
        var builder = services.AddDataProtection();
        services.AddOptions<Microsoft.AspNetCore.DataProtection.DataProtectionOptions>()
            .Configure<StorageOptions, IOptions<Configuration.DataProtectionOptions>>((options, storage, configured) =>
                options.ApplicationDiscriminator = IsLocal(storage) ? "ParishLife.Local"
                    : environment.IsDevelopment() ? "ParishLife.Development" : configured.Value.ApplicationName);
        if (environment.IsDevelopment())
            services.AddOptions<KeyManagementOptions>().Configure<StorageOptions, ILoggerFactory>((options, storage, logging) =>
                options.XmlRepository = new FileSystemXmlRepository(new DirectoryInfo(Path.Combine(StorageOptions.ResolveLocalPath(storage, environment), "keyring")), logging));
        else
        {
            // Use the configured stable application name and existing private key-ring blob; never provision a container.
            builder.PersistKeysToAzureBlobStorage(provider => new BlobClient(new Uri(provider.GetRequiredService<IOptions<Configuration.DataProtectionOptions>>().Value.BlobUri), provider.GetRequiredService<TokenCredential>())).ProtectKeysWithAzureKeyVault(provider => new Uri(provider.GetRequiredService<IOptions<Configuration.DataProtectionOptions>>().Value.KeyIdentifier), provider => provider.GetRequiredService<TokenCredential>());
        }
    }
}
