// Purpose: hosts the backend API with validated Azure services, account security, telemetry, and health checks.
// Main flow: register services -> configure middleware -> map health/OpenAPI/controllers -> run; no seeds or provisioning.

using System.Security.Claims;
using System.Threading.RateLimiting;
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
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 64 * 1024);
builder.Services.AddControllers(options => options.Filters.Add<ValidateCsrfFilter>()).AddJsonOptions(options =>
{
    options.JsonSerializerOptions.Converters.Add(new ApiGuidJsonConverter());
    options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
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
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context => RateLimitPartition.GetFixedWindowLimiter(context.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions { PermitLimit = 200, Window = TimeSpan.FromMinutes(1), QueueLimit = 0, AutoReplenishment = true }));
    options.AddPolicy("authentication", context => RateLimitPartition.GetFixedWindowLimiter(context.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions { PermitLimit = 20, Window = TimeSpan.FromMinutes(1), QueueLimit = 0, AutoReplenishment = true }));
});
var app = builder.Build();
app.UseExceptionHandler();
if (!app.Environment.IsDevelopment())
    app.UseHsts();
app.UseHttpsRedirection();
app.Use(async (context, next) =>
{
    context.Response.Headers.XContentTypeOptions = "nosniff";
    context.Response.Headers["Referrer-Policy"] = "same-origin";
    if (context.Request.Path.StartsWithSegments("/api"))
        context.Response.Headers.CacheControl = "no-store";
    await next();
});
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
app.MapOpenApi().RequireAuthorization();
app.MapControllers().RequireAuthorization();
app.Run();
public partial class Program;
