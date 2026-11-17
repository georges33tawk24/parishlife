// Purpose: hosts the actual API on Kestrel (HTTPS, development certificate) against an isolated temporary storage directory, and serves
// the built frontend from the same origin so the API's __Host- cookies work in a real browser. Test-only; never deployed.
// Main functions: ConfigureWebHost applies final test configuration and the static-page middleware; DataDirectory names the storage path.

using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ParishLife.EndToEnd;

public class EndToEndFactory(string dataDirectory, string distDirectory, string apiDirectory) : WebApplicationFactory<Program>
{
    public string DataDirectory { get; } = dataDirectory;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.UseContentRoot(apiDirectory);
        builder.ConfigureAppConfiguration((_, configuration) => configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Storage:Provider"] = "Local",
            ["Storage:LocalPath"] = DataDirectory,
            ["BackgroundJobs:Enabled"] = "false",
            ["APPLICATIONINSIGHTS_CONNECTION_STRING"] = "",
            ["OTEL_EXPORTER_OTLP_ENDPOINT"] = "",
            ["Logging:LogLevel:Default"] = "Warning"
        }));
        builder.ConfigureServices(services =>
        {
            services.AddSingleton<IStartupFilter>(new ClientAddressFilter());
            services.AddSingleton<IStartupFilter>(new StaticPagesFilter(distDirectory));
        });
        // Each role acts as its own client (ClientAddressFilter), so the sign-in limit (20 /api/auth calls a minute) stays as in production.
        // The general limit (200 API calls a minute) is lifted: a crawl opens screens far faster than a person does. See
        // docs/verification/end-to-end.md.
        builder.ConfigureTestServices(services => services.PostConfigure<RateLimiterOptions>(options => options.GlobalLimiter = null));
    }
}
