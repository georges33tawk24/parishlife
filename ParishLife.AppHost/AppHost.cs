// Purpose: starts the backend and Aspire dashboard for local logs, traces, metrics, and health.
// Main flow: CreateBuilder -> AddProject -> WithHttpHealthCheck -> Build/Run; no frontend or cloud provisioning.

using Microsoft.Extensions.Configuration;

var builder = DistributedApplication.CreateBuilder(args);
var useAzure = builder.Configuration.GetValue("Backend:UseAzure", true);
var api = builder.AddProject<Projects.ParishLife_Api>("parishlife-api", launchProfileName: "https")
    .WithEnvironment("Storage__Provider", useAzure ? "Cosmos" : "Local")
    .WithEnvironment("BackgroundJobs__Enabled", builder.Configuration.GetValue("Backend:RunBackgroundJobs", false) ? "true" : "false")
    .WithHttpHealthCheck("/health/ready");
if (useAzure)
{
    var apiSettings = new ConfigurationBuilder()
        .AddJsonFile(Path.Combine(builder.AppHostDirectory, "..", "ParishLife.Api", "appsettings.json"), optional: false)
        .AddEnvironmentVariables().Build();
    // These are configuration links, not synthetic "healthy" Azure resources. Actual access is checked by API readiness.
    api.WithUrl(apiSettings["Cosmos:Endpoint"]!, "Configured Cosmos endpoint")
        .WithUrl(apiSettings["BlobStorage:ServiceUri"]!, "Configured private storage endpoint")
        .WithUrl(new Uri(apiSettings["DataProtection:KeyIdentifier"]!).GetLeftPart(UriPartial.Authority), "Configured Key Vault endpoint");
}
builder.Build().Run();
