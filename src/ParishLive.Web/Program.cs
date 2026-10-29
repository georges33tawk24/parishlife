using System.Globalization;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Localization;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;
using ParishLive.Application.Abstractions;
using ParishLive.Infrastructure.Data;
using ParishLive.Infrastructure.Identity;
using ParishLive.Web.Tenancy;
using ParishLive.Web.Identity;

var builder = WebApplication.CreateBuilder(args);

// Razor Pages + localization (Part 4). Every user-facing string flows through IStringLocalizer.
builder.Services.AddRazorPages()
    .AddViewLocalization()
    .AddDataAnnotationsLocalization();

builder.Services.AddLocalization(options => options.ResourcesPath = "Resources");
builder.Services.AddRateLimiter(options => {
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("GuestIntake", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "local", _ => new FixedWindowRateLimiterOptions {
            PermitLimit = 20, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});

// Emit Arabic (and other non-Latin scripts) as real UTF-8 characters instead of Razor's
// default numeric HTML entities (&#x628;…) — cleaner output for a bilingual app.
builder.Services.Configure<Microsoft.Extensions.WebEncoders.WebEncoderOptions>(options =>
    options.TextEncoderSettings = new System.Text.Encodings.Web.TextEncoderSettings(
        System.Text.Unicode.UnicodeRanges.All));

var supportedCultures = new[] { new CultureInfo("en"), new CultureInfo("fr"), new CultureInfo("ar") };
builder.Services.Configure<RequestLocalizationOptions>(options =>
{
    options.DefaultRequestCulture = new RequestCulture("en");
    options.SupportedCultures = supportedCultures;
    options.SupportedUICultures = supportedCultures;
});

// --- Data + tenancy + identity (Phase 1) ---
builder.Services.AddHttpContextAccessor();

var connectionString = builder.Configuration.GetConnectionString("Default") ?? "Data Source=parishlive.db";
builder.Services.AddDbContext<AppDbContext>(options => options.UseSqlite(connectionString));

// The request-scoped tenant context (from claims) drives EF global query filters + the SaveChanges guard.
builder.Services.AddScoped<ITenantContext, ClaimsTenantContext>();
builder.Services.AddScoped<IClaimsTransformation, MembershipClaimsTransformation>();
builder.Services.AddScoped<ParishLive.Infrastructure.Authorization.OperationalAccess>();
builder.Services.AddScoped<ParishLive.Infrastructure.Data.OperationRunner>();
builder.Services.AddScoped<ParishLive.Infrastructure.Operations.ParishCaseService>();
builder.Services.AddScoped<ParishLive.Infrastructure.Operations.DocumentService>();
builder.Services.AddScoped<ParishLive.Infrastructure.Operations.FinanceService>();
builder.Services.AddScoped<ParishLive.Infrastructure.Operations.EventAdmissionService>();
builder.Services.AddScoped<ParishLive.Infrastructure.Operations.CommunityService>();
builder.Services.AddScoped<ParishLive.Infrastructure.Operations.PrivateWorkService>();
builder.Services.AddScoped<ParishLive.Infrastructure.Operations.PolicyService>();
builder.Services.AddScoped<ParishLive.Infrastructure.Operations.PeopleService>();
builder.Services.AddScoped<ParishLive.Infrastructure.Operations.AdministrationService>();
builder.Services.AddScoped<ParishLive.Infrastructure.Operations.GuestIntakeService>();
builder.Services.AddScoped<ParishLive.Infrastructure.Operations.FollowingService>();

// Application use-cases.
builder.Services.AddScoped<ParishLive.Application.Authorization.IPermissionService, ParishLive.Infrastructure.Authorization.PermissionService>();
builder.Services.AddScoped<ParishLive.Application.Reservations.IReservationService, ParishLive.Infrastructure.Reservations.ReservationService>();
builder.Services.AddScoped<ParishLive.Application.Events.IEventService, ParishLive.Infrastructure.Events.EventService>();
builder.Services.AddScoped<ParishLive.Application.Notices.INoticeService, ParishLive.Infrastructure.Notices.NoticeService>();
builder.Services.AddScoped<ParishLive.Application.Audit.IAuditService, ParishLive.Infrastructure.Audit.AuditService>();

builder.Services.AddDefaultIdentity<ApplicationUser>(options =>
    {
        options.SignIn.RequireConfirmedAccount = false; // unverified is distinct from permission to link records
        options.Password.RequiredLength = 16;
        options.Password.RequireDigit = false; options.Password.RequireLowercase = false;
        options.Password.RequireUppercase = false; options.Password.RequireNonAlphanumeric = false;
        options.Lockout.MaxFailedAccessAttempts = 5;
        options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
    })
    .AddEntityFrameworkStores<AppDbContext>()
    .AddPasswordValidator<AccountPasswordValidator>();
builder.Services.Configure<SecurityStampValidatorOptions>(o => o.ValidationInterval = TimeSpan.Zero);
builder.Services.ConfigureApplicationCookie(o =>
{
    o.ExpireTimeSpan = TimeSpan.FromMinutes(15);
    o.SlidingExpiration = true;
    o.Cookie.HttpOnly = true;
    o.Cookie.SameSite = SameSiteMode.Lax;
});

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRequestLocalization();
app.UseRouting();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.Use(async (context, next) =>
{
    if (context.User.Identity?.IsAuthenticated == true)
    {
        context.Response.Headers.CacheControl = "no-store";
        context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    }
    await next();
});
app.MapRazorPages();

// Demo endpoint used by the tenant-isolation test: returns only the notices the caller may see.
app.MapGet("/api/notices", async (ParishLive.Application.Notices.INoticeService notices) =>
        (await notices.ListRecentAsync()).Select(n => n.Title).ToList())
    .RequireAuthorization();

// Culture switch used by the language toggle. LocalRedirect keeps the return URL local.
app.MapGet("/set-culture", (string culture, string? returnUrl, HttpContext ctx) =>
{
    if (culture is not ("en" or "fr" or "ar")) return Results.BadRequest();
    ctx.Response.Cookies.Append(
        CookieRequestCultureProvider.DefaultCookieName,
        CookieRequestCultureProvider.MakeCookieValue(new RequestCulture(culture)),
        new CookieOptions { Expires = DateTimeOffset.UtcNow.AddYears(1), IsEssential = true });

    return Results.LocalRedirect(string.IsNullOrEmpty(returnUrl) ? "/" : returnUrl);
});

// Apply migrations and seed the demo archdiocese/parishes/users on startup (dev).
using (var scope = app.Services.CreateScope())
{
    var sp = scope.ServiceProvider;
    var database = sp.GetRequiredService<AppDbContext>().Database;
    if (app.Environment.IsDevelopment() || app.Environment.IsEnvironment("Testing") || builder.Configuration.GetValue<bool>("Database:ApplyMigrations"))
        await database.MigrateAsync();
    else if ((await database.GetPendingMigrationsAsync()).Any())
        throw new InvalidOperationException("Apply the reviewed database migrations during an approved maintenance window before starting this environment.");
    if (app.Environment.IsDevelopment() || app.Environment.IsEnvironment("Testing"))
        await AppDbSeeder.SeedAsync(
            sp.GetRequiredService<DbContextOptions<AppDbContext>>(),
            sp.GetRequiredService<UserManager<ApplicationUser>>());
}

if (builder.Configuration.GetValue<bool>("Bootstrap:Run"))
{
    using var scope = app.Services.CreateScope();
    var sp = scope.ServiceProvider;
    var systemDb = sp.GetRequiredService<AppDbContext>();
    await using var setupTransaction = await systemDb.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
    if (await systemDb.Memberships.IgnoreQueryFilters().AnyAsync(m => m.Role == ParishLive.Domain.Enums.SystemRole.SuperAdmin))
        throw new InvalidOperationException("Initial setup has already been completed. Use the protected administrative process.");
    var password = Environment.GetEnvironmentVariable("PARISHLIFE_BOOTSTRAP_PASSWORD");
    var email = builder.Configuration["Bootstrap:Email"];
    var displayName = builder.Configuration["Bootstrap:DisplayName"];
    var reference = builder.Configuration["Bootstrap:AuthorityReference"];
    if (password is null || password.Length is < 16 or > 200 || string.IsNullOrWhiteSpace(email) ||
        string.IsNullOrWhiteSpace(displayName) || string.IsNullOrWhiteSpace(reference))
        throw new InvalidOperationException("Supply individual bootstrap identity, authority reference and private 16–200 character credential through the documented setup configuration.");
    var manager = sp.GetRequiredService<UserManager<ApplicationUser>>();
    if (await manager.FindByNameAsync(email) is not null) throw new InvalidOperationException("Use a new individually controlled initial administrator account.");
    var admin = new ApplicationUser { UserName = email, Email = email, DisplayName = displayName, EmailConfirmed = false };
    var result = await manager.CreateAsync(admin, password);
    if (!result.Succeeded) throw new InvalidOperationException("The initial account could not be created. Check the configured identity and credential policy.");
    systemDb.Memberships.Add(new ParishLive.Domain.Entities.Membership { UserId = admin.Id,
        Role = ParishLive.Domain.Enums.SystemRole.SuperAdmin, AppointedByUserId = admin.Id, AuthorityReference = reference,
        StartsAtUtc = DateTimeOffset.UtcNow, AcceptedAtUtc = DateTimeOffset.UtcNow });
    systemDb.AdministrativeRecords.Add(new ParishLive.Domain.Entities.AdministrativeRecord { ActorUserId = admin.Id,
        TargetUserId = admin.Id, Action = "ControlledInitialSetup", OperationId = Guid.NewGuid(), AuthorityReference = reference });
    await systemDb.SaveChangesAsync();
    await setupTransaction.CommitAsync();
    Console.WriteLine("Individual initial administrator established. Clear the one-time bootstrap configuration before starting the application.");
    return;
}

app.Run();

// Exposed so the integration test project can host the app via WebApplicationFactory<Program>.
public partial class Program { }
