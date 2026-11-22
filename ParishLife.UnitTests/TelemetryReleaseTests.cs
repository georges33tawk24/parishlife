// Purpose: proves that telemetry carries the build's release tag (hardening item 7), so Application Insights can tell deploys apart.
// Main test: Telemetry_resource_names_the_release builds the host with an OTLP endpoint that nothing listens on (no data leaves the machine)
// and reads service.version from the tracer provider's resource.

using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using OpenTelemetry;
using OpenTelemetry.Trace;
using ParishLife.Api.Extensions;
using Xunit;

namespace ParishLife.UnitTests;

public sealed class TelemetryReleaseTests
{
    [Fact]
    public async Task Telemetry_resource_names_the_release()
    {
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = "Development" });
        builder.Configuration["OTEL_EXPORTER_OTLP_ENDPOINT"] = "http://127.0.0.1:9";
        builder.AddParishLifeTelemetry();
        await using var app = builder.Build();

        var resource = app.Services.GetRequiredService<TracerProvider>().GetResource();

        Assert.Contains('+', TelemetryExtensions.Release); // 1.0.0+<commit>: the SDK embeds the source revision
        Assert.Equal(TelemetryExtensions.Release, Assert.Single(resource.Attributes, attribute => attribute.Key == "service.version").Value);
    }
}
