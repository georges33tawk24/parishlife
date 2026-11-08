// Purpose: routes backend telemetry to Aspire locally and Application Insights when configured.
// Main function: AddParishLifeTelemetry enables only configured OTLP/Azure Monitor exporters.

using Microsoft.OpenTelemetry;

namespace ParishLife.Api.Extensions;

public static class TelemetryExtensions
{
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
        return builder;
    }
}
