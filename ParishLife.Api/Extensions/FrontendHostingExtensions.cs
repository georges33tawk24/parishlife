// Purpose: serves the built frontend (frontend/dist, published into wwwroot only with -p:IncludeFrontend=true) from the API's own origin,
// because the API's __Host- cookies are Secure and SameSite=Strict with no CORS: the pages and /api must share one HTTPS host.
// Main functions: UseParishLifeFrontend adds default-file and static-file middleware when wwwroot holds index.html (hashed assets cached for a
// year, pages revalidated, pages sent with a Content-Security-Policy); with no wwwroot (an API-only deployment) it adds nothing.
// ContentSecurityPolicy builds the page policy, allowing each page's inline start-up script only by its SHA-256 hash.

using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace ParishLife.Api.Extensions;

public static partial class FrontendHostingExtensions
{
    public static WebApplication UseParishLifeFrontend(this WebApplication app)
    {
        var root = app.Environment.WebRootPath;
        if (string.IsNullOrEmpty(root) || !File.Exists(Path.Combine(root, "index.html")))
            return app;
        var policy = ContentSecurityPolicy(root);
        app.UseDefaultFiles();
        app.UseStaticFiles(new StaticFileOptions
        {
            OnPrepareResponse = context =>
            {
                var headers = context.Context.Response.Headers;
                headers.CacheControl = context.Context.Request.Path.StartsWithSegments("/assets/app") ? "public, max-age=31536000, immutable" : "no-cache";
                if (context.File.Name.EndsWith(".html", StringComparison.OrdinalIgnoreCase))
                    headers.ContentSecurityPolicy = policy;
            }
        });
        return app;
    }

    /// <summary>
    /// The pages' policy: scripts only from this origin, Cloudflare Turnstile and the exact inline start-up scripts of the published pages;
    /// fonts from Google Fonts; images from anywhere over HTTPS (parish photos), data: and blob: (previews); no framing of the pages.
    /// </summary>
    public static string ContentSecurityPolicy(string webRoot)
    {
        var hashes = Directory.EnumerateFiles(webRoot, "*.html")
            .SelectMany(file => InlineScript().Matches(File.ReadAllText(file)).Select(match => match.Groups[1].Value))
            .Select(script => "'sha256-" + Convert.ToBase64String(SHA256.HashData(Encoding.UTF8.GetBytes(script))) + "'")
            .Distinct(StringComparer.Ordinal)
            .Order(StringComparer.Ordinal);
        const string turnstile = "https://challenges.cloudflare.com";
        return string.Join("; ",
            "default-src 'self'",
            $"script-src 'self' {string.Join(' ', hashes)} {turnstile}",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com data:",
            "img-src 'self' data: blob: https:",
            $"connect-src 'self' {turnstile}",
            $"frame-src {turnstile}",
            "worker-src 'self'",
            "manifest-src 'self'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'");
    }

    // An inline <script> element without a src attribute; its exact text is what the browser hashes.
    [GeneratedRegex(@"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", RegexOptions.Singleline | RegexOptions.IgnoreCase)]
    private static partial Regex InlineScript();
}
