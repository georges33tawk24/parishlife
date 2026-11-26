// Purpose: serves the built frontend (frontend/dist, published into wwwroot only with -p:IncludeFrontend=true) from the API's own origin,
// because the API's __Host- cookies are Secure and SameSite=Strict with no CORS: the pages and /api must share one HTTPS host.
// Main functions: UseParishLifeFrontend adds default-file and static-file middleware (the site root shows the public home page,
// public.html, when it exists; the portal stays at /index.html) when wwwroot holds index.html (hashed assets cached for a
// year, pages revalidated, pages sent with a Content-Security-Policy); with no wwwroot (an API-only deployment) it adds nothing.
// ContentSecurityPolicy builds the page policy, allowing each page's inline start-up script only by its SHA-256 hash, and form posts
// to this origin plus the external sign-in providers' authorization origins (their redirect follows a same-origin form post).
// Before the static files, GET /public.html?parish=<id> and GET /sitemap.xml are generated (Middleware/PublicPages.cs), rate limited, and
// scripts and styles go out as the build's precompressed copies when the browser accepts them (Middleware/PrecompressedAssets.cs).

using System.Security.Cryptography;
using Microsoft.AspNetCore.StaticFiles;
using ParishLife.Api.Configuration;
using ParishLife.Api.Middleware;
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
        var publicPage = File.Exists(Path.Combine(root, "public.html")) ? File.ReadAllText(Path.Combine(root, "public.html")) : null;
        // Generated answers (a parish page's head, the sitemap) read storage, so unlike the static files they count against the per-address limit.
        app.MapWhen(context => IsGenerated(context.Request, publicPage is not null), generated =>
        {
            generated.UseRateLimiter();
            generated.Run(async context =>
            {
                if (context.Request.Path.Equals("/sitemap.xml", StringComparison.OrdinalIgnoreCase))
                {
                    await PublicPages.SitemapAsync(context);
                    return;
                }
                context.Response.Headers.CacheControl = "no-cache";
                context.Response.Headers.ContentSecurityPolicy = policy;
                await PublicPages.ParishPageAsync(context, publicPage!);
            });
        });
        app.UsePrecompressedAssets(root);
        // Opening the site shows the public home page; sign-in is one click away (owner, 23 November 2026).
        var defaults = new DefaultFilesOptions();
        defaults.DefaultFileNames.Clear();
        if (File.Exists(Path.Combine(root, "public.html")))
            defaults.DefaultFileNames.Add("public.html");
        defaults.DefaultFileNames.Add("index.html");
        app.UseDefaultFiles(defaults);
        var types = new FileExtensionContentTypeProvider();
        types.Mappings[".br"] = "application/octet-stream"; // the build's compressed copies; Apply gives them the original type
        types.Mappings[".gz"] = "application/octet-stream";
        app.UseStaticFiles(new StaticFileOptions
        {
            ContentTypeProvider = types,
            OnPrepareResponse = context =>
            {
                PrecompressedAssets.Apply(context.Context);
                var headers = context.Context.Response.Headers;
                headers.CacheControl = context.Context.Request.Path.StartsWithSegments("/assets/app") ? "public, max-age=31536000, immutable" : "no-cache";
                if (context.File.Name.EndsWith(".html", StringComparison.OrdinalIgnoreCase))
                    headers.ContentSecurityPolicy = policy;
            }
        });
        return app;
    }

    private static bool IsGenerated(HttpRequest request, bool hasPublicPage)
        => (HttpMethods.IsGet(request.Method) || HttpMethods.IsHead(request.Method))
            && (request.Path.Equals("/sitemap.xml", StringComparison.OrdinalIgnoreCase)
                // The directory and every parish page carry their text in the body for readers without JavaScript (T5, 26 November 2026).
                || hasPublicPage && request.Path.Equals("/public.html", StringComparison.OrdinalIgnoreCase));

    /// <summary>
    /// The pages' policy: scripts only from this origin, Cloudflare Turnstile and the exact inline start-up scripts of the published pages;
    /// fonts self-hosted under /assets/fonts (no Google Fonts host since the fonts moved here); images from anywhere over HTTPS (parish photos), data: and blob: (previews); no framing of the pages.
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
            "style-src 'self' 'unsafe-inline'",
            "font-src 'self' data:",
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
