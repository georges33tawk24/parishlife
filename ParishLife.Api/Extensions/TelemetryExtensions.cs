// Purpose: routes backend telemetry to Aspire locally and Application Insights when configured.
// Main function: AddParishLifeTelemetry enables only configured OTLP/Azure Monitor exporters and tags every signal with this build's release
// (service.version = the informational version, 1.0.0+<commit>; Application Insights shows it as application_Version), so an error or a slow
// request can be traced to the deploy that brought it. The role name stays the one App Service reports.

using System.Reflection;
using Microsoft.OpenTelemetry;
using OpenTelemetry;
using OpenTelemetry.Resources;

namespace ParishLife.Api.Extensions;

public static class TelemetryExtensions
{
    public static string Release { get; } =
        typeof(TelemetryExtensions).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion ?? "unknown";

    public static WebApplicationBuilder AddParishLifeTelemetry(this WebApplicationBuilder builder)
    {
        var connection = builder.Configuration["APPLICATIONINSIGHTS_CONNECTION_STRING"];
        var otlp = builder.Configuration["OTEL_EXPORTER_OTLP_ENDPOINT"];
        if (string.IsNullOrWhiteSpace(connection) && string.IsNullOrWhiteSpace(otlp))
            return builder;
        builder.UseMicrosoftOpenTelemetry(options =>
        {
            options.Exporters = (string.IsNullOrWhiteSpace(connection) ? (ExportTarget)0 : ExportTarget.AzureMonitor) | (string.IsNullOrWhiteSpace(otlp) ? (ExportTarget)0 : ExportTarget.Otlp);
            if (!string.IsNullOrWhiteSpace(connection))
                options.AzureMonitor.ConnectionString = connection;
        });
        builder.Services.AddOpenTelemetry().ConfigureResource(resource => resource.AddAttributes([new("service.version", Release)]));
        return builder;
    }
}
