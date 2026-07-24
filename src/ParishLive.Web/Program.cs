using System.Globalization;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Localization;
using Microsoft.EntityFrameworkCore;
using ParishLive.Application.Abstractions;
using ParishLive.Infrastructure.Data;
using ParishLive.Infrastructure.Identity;
using ParishLive.Web.Tenancy;

var builder = WebApplication.CreateBuilder(args);

// Razor Pages + localization (Part 4). Every user-facing string flows through IStringLocalizer.
builder.Services.AddRazorPages()
    .AddViewLocalization()
    .AddDataAnnotationsLocalization();

builder.Services.AddLocalization(options => options.ResourcesPath = "Resources");

// Emit Arabic (and other non-Latin scripts) as real UTF-8 characters instead of Razor's
// default numeric HTML entities (&#x628;…) — cleaner output for a bilingual app.
builder.Services.Configure<Microsoft.Extensions.WebEncoders.WebEncoderOptions>(options =>
    options.TextEncoderSettings = new System.Text.Encodings.Web.TextEncoderSettings(
        System.Text.Unicode.UnicodeRanges.All));

var supportedCultures = new[] { new CultureInfo("en"), new CultureInfo("ar") };
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

// Application use-cases.
builder.Services.AddScoped<ParishLive.Application.Authorization.IPermissionService, ParishLive.Infrastructure.Authorization.PermissionService>();
builder.Services.AddScoped<ParishLive.Application.Reservations.IReservationService, ParishLive.Infrastructure.Reservations.ReservationService>();
builder.Services.AddScoped<ParishLive.Application.Events.IEventService, ParishLive.Infrastructure.Events.EventService>();
builder.Services.AddScoped<ParishLive.Application.Notices.INoticeService, ParishLive.Infrastructure.Notices.NoticeService>();
builder.Services.AddScoped<ParishLive.Application.Audit.IAuditService, ParishLive.Infrastructure.Audit.AuditService>();

builder.Services.AddDefaultIdentity<ApplicationUser>(options => options.SignIn.RequireConfirmedAccount = false)
    .AddEntityFrameworkStores<AppDbContext>();

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
app.UseAuthentication();
app.UseAuthorization();
app.MapRazorPages();

// Demo endpoint used by the tenant-isolation test: returns only the notices the caller may see.
app.MapGet("/api/notices", async (AppDbContext db) =>
        await db.Notices.OrderBy(n => n.Title).Select(n => n.Title).ToListAsync())
    .RequireAuthorization();

// Culture switch used by the language toggle. LocalRedirect keeps the return URL local.
app.MapGet("/set-culture", (string culture, string? returnUrl, HttpContext ctx) =>
{
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
    await sp.GetRequiredService<AppDbContext>().Database.MigrateAsync();
    await AppDbSeeder.SeedAsync(
        sp.GetRequiredService<DbContextOptions<AppDbContext>>(),
        sp.GetRequiredService<UserManager<ApplicationUser>>());
}

app.Run();

// Exposed so the integration test project can host the app via WebApplicationFactory<Program>.
public partial class Program { }
