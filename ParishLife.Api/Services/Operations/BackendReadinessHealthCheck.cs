// Purpose: exposes bounded, read-only dependency readiness to App Service and Aspire.
// Main function: CheckHealthAsync maps the cached probe report to Healthy/Unhealthy without private details.

using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace ParishLife.Api.Services.Operations;

internal sealed class BackendReadinessHealthCheck(InfrastructureReadiness readiness) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        var report = await readiness.ProbeAsync(cancellationToken);
        return report.Ready ? HealthCheckResult.Healthy("Required backend dependencies are accessible.") : HealthCheckResult.Unhealthy("A required backend dependency is unavailable or mismatched.");
    }
}
