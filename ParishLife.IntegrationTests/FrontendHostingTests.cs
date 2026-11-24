// Purpose: verifies the opt-in single-origin hosting of the built frontend (UseParishLifeFrontend) against isolated temporary directories.
// Main tests: Pages_are_served_with_caching_and_a_hashed_script_policy (a web root with index.html; form posts may redirect to the
// sign-in providers) and
// Without_a_web_root_the_api_serves_no_pages (the API-only deployment is unchanged).

using System.Net;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public sealed class FrontendHostingTests
{
    private const string Script = "(() => { document.documentElement.lang = 'en'; })();";

    [Fact]
    public async Task Pages_are_served_with_caching_and_a_hashed_script_policy()
    {
        var data = Path.Combine(Path.GetTempPath(), "ParishLife-Hosting-" + Guid.NewGuid().ToString("N"));
        var web = Path.Combine(Path.GetTempPath(), "ParishLife-Web-" + Guid.NewGuid().ToString("N"));
        try
        {
            Directory.CreateDirectory(Path.Combine(web, "assets", "app"));
            await File.WriteAllTextAsync(Path.Combine(web, "index.html"), $"<!doctype html><html><head><script>{Script}</script><script type=\"module\" src=\"/assets/app/portal-abc.js\"></script></head><body></body></html>");
            await File.WriteAllTextAsync(Path.Combine(web, "assets", "app", "portal-abc.js"), "export {};");
            await File.WriteAllTextAsync(Path.Combine(web, "public.html"), "<!doctype html><html><body>public-home</body></html>");
            await using var factory = new LocalApiFactory(data).WithWebHostBuilder(builder => builder.UseSetting(WebHostDefaults.WebRootKey, web));
            using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new("https://localhost") });

            var page = await client.GetAsync("/");
            Assert.Equal(HttpStatusCode.OK, page.StatusCode);
            Assert.Equal("text/html", page.Content.Headers.ContentType?.MediaType);
            // The site root is the public home page; the portal stays at /index.html.
            Assert.Contains("public-home", await page.Content.ReadAsStringAsync(), StringComparison.Ordinal);
            Assert.Contains("portal-abc.js", await (await client.GetAsync("/index.html")).Content.ReadAsStringAsync(), StringComparison.Ordinal);
            Assert.Equal("no-cache", page.Headers.CacheControl?.ToString());
            var policy = string.Join(";", page.Headers.GetValues("Content-Security-Policy"));
            var hash = "'sha256-" + Convert.ToBase64String(SHA256.HashData(Encoding.UTF8.GetBytes(Script))) + "'";
            Assert.Contains("default-src 'self'", policy, StringComparison.Ordinal);
            Assert.Contains(hash, policy, StringComparison.Ordinal);
            Assert.Contains("frame-ancestors 'none'", policy, StringComparison.Ordinal);
            // The provider sign-in form post is answered with a redirect to the provider, which form-action also governs.
            Assert.Contains("form-action 'self' https://accounts.google.com https://login.live.com https://login.microsoftonline.com", policy, StringComparison.Ordinal);
            Assert.DoesNotContain("'unsafe-inline' https://challenges", policy, StringComparison.Ordinal);
            Assert.DoesNotContain("script-src 'self' 'unsafe-inline'", policy, StringComparison.Ordinal);

            var asset = await client.GetAsync("/assets/app/portal-abc.js");
            Assert.Equal(HttpStatusCode.OK, asset.StatusCode);
            Assert.True(asset.Headers.CacheControl?.Public);
            Assert.Equal(TimeSpan.FromDays(365), asset.Headers.CacheControl?.MaxAge);
            Assert.Contains("immutable", string.Join(",", asset.Headers.GetValues("Cache-Control")), StringComparison.Ordinal);
            Assert.False(asset.Headers.Contains("Content-Security-Policy"));

            var api = await client.GetAsync("/api/auth/csrf");
            Assert.Equal(HttpStatusCode.OK, api.StatusCode);
            Assert.False(api.Headers.Contains("Content-Security-Policy"));
            Assert.True(api.Headers.CacheControl?.NoStore);
        }
        finally
        {
            foreach (var directory in new[] { data, web })
                if (Directory.Exists(directory))
                    Directory.Delete(directory, true);
        }
    }

    [Fact]
    public async Task Without_a_web_root_the_api_serves_no_pages()
    {
        var data = Path.Combine(Path.GetTempPath(), "ParishLife-Hosting-" + Guid.NewGuid().ToString("N"));
        try
        {
            await using var factory = new LocalApiFactory(data);
            using var client = factory.Client();
            Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/index.html")).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health/live")).StatusCode);
        }
        finally
        {
            if (Directory.Exists(data))
                Directory.Delete(data, true);
        }
    }
}
