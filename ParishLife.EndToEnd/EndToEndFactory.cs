// Purpose: hosts the actual API on Kestrel (HTTPS, development certificate) against an isolated temporary storage directory, with the built
// frontend as its web root, so the API's own production hosting (UseParishLifeFrontend: same origin, caching, Content-Security-Policy)
// serves the pages the browser tests open. Test-only; never deployed.
// Main functions: ConfigureWebHost applies final test configuration, the web root, the per-test client address and, when asked, Cloudflare's
// published Turnstile test keys (TestSiteKey/TestSecretKey: always pass, verified by Cloudflare's real siteverify), and a stand-in Google
// client (sign-in buttons and the redirect to Google, never a completed sign-in); DataDirectory names the storage path.

using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ParishLife.EndToEnd;

public class EndToEndFactory(string dataDirectory, string distDirectory, string apiDirectory, bool turnstile = false) : WebApplicationFactory<Program>
{
    // Cloudflare's documented dummy keys for testing: the widget always passes and siteverify always accepts its token. Not secrets.
    public const string TestSiteKey = "1x00000000000000000000AA";
    public const string TestSecretKey = "1x0000000000000000000000000000000AA";

    public string DataDirectory { get; } = dataDirectory;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.UseContentRoot(apiDirectory);
        // The pages come from frontend/dist exactly as a -p:IncludeFrontend=true publish serves them from wwwroot.
        builder.UseSetting(WebHostDefaults.WebRootKey, distDirectory);
        builder.ConfigureAppConfiguration((_, configuration) => configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Storage:Provider"] = "Local",
            ["Storage:LocalPath"] = DataDirectory,
            ["BackgroundJobs:Enabled"] = "false",
            ["APPLICATIONINSIGHTS_CONNECTION_STRING"] = "",
            ["OTEL_EXPORTER_OTLP_ENDPOINT"] = "",
            ["Logging:LogLevel:Default"] = "Warning",
            ["Turnstile:SiteKey"] = turnstile ? TestSiteKey : null,
            ["Turnstile:SecretKey"] = turnstile ? TestSecretKey : null
        }));
        // A stand-in Google client, so the sign-in screen shows its buttons and the browser test can follow the form post's redirect to
        // accounts.google.com under the page policy. It never completes: Google rejects this made-up client. Not a secret. Host settings,
        // because Program registers providers while it builds its services (later configuration sources arrive too late for that).
        builder.UseSetting("ExternalSignIn:google:ClientId", "e2e-stand-in-client");
        builder.UseSetting("ExternalSignIn:google:ClientSecret", "e2e-stand-in-not-a-secret");
        builder.ConfigureServices(services => services.AddSingleton<IStartupFilter>(new ClientAddressFilter()));
        // Each role acts as its own client (ClientAddressFilter), so the sign-in limit (20 /api/auth calls a minute) stays as in production.
        // The general limit (200 API calls a minute) is lifted: a crawl opens screens far faster than a person does. See
        // docs/verification/end-to-end.md.
        builder.ConfigureTestServices(services => services.PostConfigure<RateLimiterOptions>(options => options.GlobalLimiter = null));
    }
}
