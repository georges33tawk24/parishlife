// Purpose: public install and offline-reading metadata (X11). The manifest comes only from validated "PublicApp" configuration (no invented name
// or branding); the offline policy lists the reads marked [PublicCache] and states that every other route is no-store and online-only.
// Main functions: Manifest and OfflinePolicy; Link and Color validate operator configuration the same way homepage links are validated.

using System.Reflection;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using ParishLife.Api.Configuration;
using ParishLife.Api.DTOs.Publishing;
using ParishLife.Api.Middleware;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Publishing;

public class PublicAppService(IConfiguration configuration)
{
    private static readonly string[] Displays = ["browser", "minimal-ui", "standalone", "fullscreen"];
    private static readonly Lazy<PublicCacheRouteDto[]> Routes = new(Discover);

    // Read from final host configuration on each request so test/host overrides apply; nothing is cached across configuration reloads.
    public WebAppManifestDto Manifest()
    {
        var options = configuration.GetSection("PublicApp").Get<PublicAppOptions>() ?? new();
        if (string.IsNullOrWhiteSpace(options.Name))
            throw new DomainException("app_manifest_not_configured", "No install name has been configured for this deployment.", FailureKind.NotFound);
        try
        {
            return new WebAppManifestDto
            {
                Name = Guard.Text(options.Name, "PublicApp:Name", 100),
                ShortName = Guard.Text(string.IsNullOrWhiteSpace(options.ShortName) ? options.Name : options.ShortName, "PublicApp:ShortName", 30),
                Description = string.IsNullOrWhiteSpace(options.Description) ? null : Guard.Text(options.Description, "PublicApp:Description", 300),
                StartUrl = options.StartUrl.StartsWith('/') && !options.StartUrl.StartsWith("//", StringComparison.Ordinal) ? HomepageService.Link(options.StartUrl)
                    : throw new DomainException("invalid_input", "PublicApp:StartUrl must be a path on this site."),
                Display = Displays.Contains(options.Display) ? options.Display : throw new DomainException("invalid_input", "PublicApp:Display is not a manifest display mode."),
                ThemeColor = Color(options.ThemeColor), BackgroundColor = Color(options.BackgroundColor),
                Icons = options.Icons.Take(20).Select(icon => new WebAppIconDto
                {
                    Src = HomepageService.Link(icon.Src), Sizes = Guard.Text(icon.Sizes, "PublicApp:Icons:Sizes", 40),
                    Type = icon.Type is "image/png" or "image/svg+xml" or "image/webp" ? icon.Type : throw new DomainException("invalid_input", "Icon type must be image/png, image/svg+xml or image/webp."),
                    Purpose = icon.Purpose is null or "any" or "maskable" or "monochrome" ? icon.Purpose : throw new DomainException("invalid_input", "Icon purpose is not supported.")
                }).ToArray()
            };
        }
        catch (DomainException error) when (error.Code == "invalid_input")
        {
            // A misconfigured deployment is an operator problem; it is reported as unavailable rather than as a visitor input error.
            throw new DomainException("app_manifest_misconfigured", "The install metadata configuration is invalid: " + error.Message, FailureKind.Unavailable);
        }
    }

    public OfflinePolicyDto OfflinePolicy() => new()
    {
        CacheableReads = Routes.Value,
        Rules =
        [
            "Only the listed anonymous public reads may be kept for offline reading; revalidate them with If-None-Match and show their last refresh time.",
            "Every other API response is Cache-Control: no-store and must not be written to offline storage, including signed-in and personal reads.",
            "Offline copies are stale reference only: never proof of current schedules, availability, consent or authority.",
            "No action is queued or performed offline. Without a connection, say the action has not been confirmed and offer retry or the parish office."
        ]
    };

    private static string? Color(string? value)
        => string.IsNullOrWhiteSpace(value) ? null
            : value.Length == 7 && value[0] == '#' && value.Skip(1).All(char.IsAsciiHexDigit) ? value
            : throw new DomainException("invalid_input", "Colors must be #RRGGBB.");

    private static PublicCacheRouteDto[] Discover()
        => typeof(PublicAppService).Assembly.GetTypes().Where(t => typeof(ControllerBase).IsAssignableFrom(t) && !t.IsAbstract)
            .SelectMany(type => type.GetMethods().Select(method => (type, method, cache: method.GetCustomAttribute<PublicCacheAttribute>())))
            .Where(x => x.cache is not null)
            .Select(x =>
            {
                var prefix = x.type.GetCustomAttribute<RouteAttribute>()?.Template ?? string.Empty;
                var own = x.method.GetCustomAttribute<HttpMethodAttribute>()?.Template;
                return new PublicCacheRouteDto { Template = "/" + (string.IsNullOrEmpty(own) ? prefix : prefix + "/" + own), MaxAgeSeconds = x.cache!.MaxAgeSeconds };
            })
            .OrderBy(r => r.Template, StringComparer.Ordinal).ToArray();
}
