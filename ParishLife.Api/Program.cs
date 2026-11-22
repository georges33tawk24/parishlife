// Purpose: hosts the backend API with validated Azure services, account security, telemetry, and health checks.
// Main flow: register services -> configure middleware (and the built frontend when published into wwwroot) -> map health/OpenAPI/controllers
// -> run; no seeds or provisioning.
// Client address (rate limits, Turnstile, audit): when hosted, App Service's front end is the one proxy in front of Kestrel and appends the
// caller's address to X-Forwarded-For. Only that one right-most hop is trusted (ForwardLimit 1), so addresses a client writes into the
// header itself are ignored. Development (no proxy) trusts nothing unless ForwardedHeaders:Enabled is set.

using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using ParishLife.Api.Authorization;
using ParishLife.Api.Configuration;
using ParishLife.Api.Extensions;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Middleware;

var builder = WebApplication.CreateBuilder(args);
builder.AddParishLifeTelemetry();
builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 64 * 1024;
    options.AddServerHeader = false; // no "Server: Kestrel"
});
// One year; includeSubDomains is safe because the only other web host, www, is served over HTTPS by Cloudflare. Preload is the owner's
// decision (hardening/reports/03-security.md, "Needs your action").
builder.Services.AddHsts(options =>
{
    options.MaxAge = TimeSpan.FromDays(365);
    options.IncludeSubDomains = true;
});
builder.Services.AddControllers(options => options.Filters.Add<ValidateCsrfFilter>()).AddJsonOptions(options =>
{
    options.JsonSerializerOptions.Converters.Add(new ApiGuidJsonConverter());
    options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
});
// Brotli or gzip for the static pages, scripts and styles (the portal script is 1.6 MB uncompressed). Never for /api: an answer that
// carries a token next to text the caller chose must not be compressed over HTTPS (BREACH); the API stays uncompressed.
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<Microsoft.AspNetCore.ResponseCompression.BrotliCompressionProvider>();
    options.Providers.Add<Microsoft.AspNetCore.ResponseCompression.GzipCompressionProvider>();
    options.MimeTypes = Microsoft.AspNetCore.ResponseCompression.ResponseCompressionDefaults.MimeTypes.Concat(["image/svg+xml", "application/manifest+json"]);
});
builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.AddParishLifeBackend(builder.Configuration, builder.Environment);
builder.Services.AddScoped<ICurrentActor, CurrentActor>();
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-CSRF-TOKEN";
    options.Cookie.Name = "__Host-ParishLife.Csrf";
    options.Cookie.Path = "/";
    options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
    options.Cookie.SameSite = SameSiteMode.Strict;
    options.Cookie.HttpOnly = true;
});
builder.Services.AddAuthentication(IdentityConstants.ApplicationScheme).AddIdentityCookies();
builder.Services.ConfigureApplicationCookie(options =>
{
    options.Cookie.Name = "__Host-ParishLife";
    options.Cookie.HttpOnly = true;
    options.Cookie.Path = "/";
    options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
    options.Cookie.SameSite = SameSiteMode.Strict;
    options.SlidingExpiration = false;
    options.ExpireTimeSpan = TimeSpan.FromHours(8);
    options.Events.OnRedirectToLogin = context =>
    {
        context.Response.StatusCode = 401;
        return Task.CompletedTask;
    };
    options.Events.OnRedirectToAccessDenied = context =>
    {
        context.Response.StatusCode = 403;
        return Task.CompletedTask;
    };
    options.Events.OnValidatePrincipal = async context =>
    {
        var id = context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
        var sid = context.Principal?.FindFirstValue("sid");
        var stamp = context.Principal?.FindFirstValue("AspNet.Identity.SecurityStamp");
        var method = context.Principal?.FindFirstValue("amr");
        if (id is null || sid is null || stamp is null || method is null
            || !await context.HttpContext.RequestServices.GetRequiredService<AccountSessionService>().ValidAsync(id, sid, stamp, context.HttpContext.RequestAborted, method))
            context.RejectPrincipal();
    };
});
builder.Services.AddAuthorization();
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = (context, _) =>
    {
        SecurityEvents.Log(context.HttpContext, "security.rate_limited");
        return ValueTask.CompletedTask;
    };
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context => RateLimitPartition.GetFixedWindowLimiter(context.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions { PermitLimit = 200, Window = TimeSpan.FromMinutes(1), QueueLimit = 0, AutoReplenishment = true }));
    options.AddPolicy("authentication", context => RateLimitPartition.GetFixedWindowLimiter(context.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions { PermitLimit = 20, Window = TimeSpan.FromMinutes(1), QueueLimit = 0, AutoReplenishment = true }));
});
var app = builder.Build();
// When App Service sets ASPNETCORE_FORWARDEDHEADERS_ENABLED the framework already runs this middleware with the same settings (cleared
// known proxies, ForwardLimit 1); running it twice would let the second pass trust a client-written entry, so it is added only otherwise.
if (app.Configuration.GetValue("ForwardedHeaders:Enabled", !app.Environment.IsDevelopment()) && !app.Configuration.GetValue<bool>("FORWARDEDHEADERS_ENABLED"))
{
    var forwarded = new ForwardedHeadersOptions { ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto, ForwardLimit = 1 };
    forwarded.KnownIPNetworks.Clear(); // the front end's addresses are not fixed; nothing but the front end can reach the app
    forwarded.KnownProxies.Clear();
    app.UseForwardedHeaders(forwarded);
}
app.UseExceptionHandler();
if (!app.Environment.IsDevelopment())
    app.UseHsts();
app.UseHttpsRedirection();
app.Use(async (context, next) =>
{
    context.Response.Headers.XContentTypeOptions = "nosniff";
    context.Response.Headers["Referrer-Policy"] = "same-origin";
    context.Response.Headers.XFrameOptions = "DENY";
    context.Response.Headers["Cross-Origin-Opener-Policy"] = "same-origin";
    // Geolocation stays for the public "near me" search; passkeys use the same-origin default.
    context.Response.Headers["Permissions-Policy"] = "camera=(), microphone=(), payment=(), usb=(), geolocation=(self)";
    if (context.Request.Path.StartsWithSegments("/api"))
        context.Response.Headers.CacheControl = "no-store";
    await next();
});
app.UseWhen(context => !context.Request.Path.StartsWithSegments("/api"), pages => pages.UseResponseCompression());
app.UseParishLifeFrontend(); // only when the frontend was published into wwwroot; static pages do not count against the API rate limit
app.UseRateLimiter();
app.UseAuthentication();
app.UseMiddleware<RecoverySessionMiddleware>();
app.UseAuthorization();
app.MapGet("/health/live", () => Results.Ok(new { status = "Alive" })).AllowAnonymous();
app.MapGet("/health/ready", async (HealthCheckService health, CancellationToken cancellationToken) =>
{
    var result = await health.CheckHealthAsync(check => check.Tags.Contains("ready"), cancellationToken);
    return Results.Json(new { status = result.Status.ToString() }, statusCode: result.Status == HealthStatus.Healthy ? StatusCodes.Status200OK : StatusCodes.Status503ServiceUnavailable);
}).AllowAnonymous();
// The API description is a development aid only: in production it would map every route for any signed-in account.
if (app.Configuration.GetValue("OpenApi:Enabled", app.Environment.IsDevelopment()))
    app.MapOpenApi().RequireAuthorization();
app.MapControllers().RequireAuthorization();
app.Run();
public partial class Program;
