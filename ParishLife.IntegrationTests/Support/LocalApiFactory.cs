// Purpose: hosts the actual API against an explicitly isolated fixture directory with no Azure calls or frontend.
// Main functions: ConfigureWebHost applies final test configuration; Client asserts the actual document path before HTTP use.

using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.Configuration;
using Xunit;

namespace ParishLife.IntegrationTests.Support;

internal class LocalApiFactory(string directory, bool runJobs = false) : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.ConfigureAppConfiguration((_, configuration) => configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Storage:Provider"] = "Local",
            ["Storage:LocalPath"] = directory,
            ["BackgroundJobs:Enabled"] = runJobs ? "true" : "false",
            ["APPLICATIONINSIGHTS_CONNECTION_STRING"] = "",
            ["OTEL_EXPORTER_OTLP_ENDPOINT"] = ""
        }));
    }

    public HttpClient Client()
    {
        var client = CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost"),
            HandleCookies = true,
            AllowAutoRedirect = false
        });
        Assert.Equal(directory, Services.GetRequiredService<StorageOptions>().LocalPath);
        return client;
    }
}
