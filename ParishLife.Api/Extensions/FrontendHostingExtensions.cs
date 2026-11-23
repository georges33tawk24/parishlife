// Purpose: serves the built frontend (frontend/dist, published into wwwroot only with -p:IncludeFrontend=true) from the API's own origin,
// because the API's __Host- cookies are Secure and SameSite=Strict with no CORS: the pages and /api must share one HTTPS host.
// Main functions: UseParishLifeFrontend adds default-file and static-file middleware (the site root shows the public home page,
// public.html, when it exists; the portal stays at /index.html) when wwwroot holds index.html (hashed assets cached for a
// year, pages revalidated, pages sent with a Content-Security-Policy); with no wwwroot (an API-only deployment) it adds nothing.
// ContentSecurityPolicy builds the page policy, allowing each page's inline start-up script only by its SHA-256 hash, and form posts
// to this origin plus the external sign-in providers' authorization origins (their redirect follows a same-origin form post).

using System.Security.Cryptography;
using ParishLife.Api.Configuration;
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
        // Opening the site shows the public home page; sign-in is one click away (owner, 23 November 2026).
        var defaults = new DefaultFilesOptions();
        defaults.DefaultFileNames.Clear();
        if (File.Exists(Path.Combine(root, "public.html")))
            defaults.DefaultFileNames.Add("public.html");
        defaults.DefaultFileNames.Add("index.html");
        app.UseDefaultFiles(defaults);
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
        // Google/Microsoft sign-in is a same-origin form post that the API answers with a redirect to the provider; browsers apply
        // form-action to that redirect too, so each provider's authorization origin (and Microsoft's personal-account host) is allowed.
        var providers = string.Join(' ', ExternalProviderOptions.Providers.Values
            .Select(endpoints => new Uri(endpoints[0]).GetLeftPart(UriPartial.Authority))
            .Append(MicrosoftPersonalAccounts)
            .Distinct(StringComparer.Ordinal)
            .Order(StringComparer.Ordinal));
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
            $"form-action 'self' {providers}",
            "frame-ancestors 'none'");
    }

    // Microsoft may hand a personal (Outlook/Hotmail) account from its authorization endpoint to this host in the same redirect chain.
    private const string MicrosoftPersonalAccounts = "https://login.live.com";

    // An inline <script> element without a src attribute; its exact text is what the browser hashes.
    [GeneratedRegex(@"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", RegexOptions.Singleline | RegexOptions.IgnoreCase)]
    private static partial Regex InlineScript();
}
