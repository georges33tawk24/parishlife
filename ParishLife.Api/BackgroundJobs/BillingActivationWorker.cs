// Purpose: Claims durable paid-coverage work and retries safely when background processing is explicitly enabled.
// Main functions: ExecuteAsync.

using ParishLife.Api.Services.Billing;

namespace ParishLife.Api.BackgroundJobs;

internal sealed class BillingActivationWorker(IServiceScopeFactory scopes, ILogger<BillingActivationWorker> logger,
    IConfiguration configuration, IHostEnvironment environment) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!configuration.GetValue("BackgroundJobs:Enabled", !environment.IsDevelopment())) return;
        var worker = Guid.NewGuid().ToString("N");
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(15));
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                await scope.ServiceProvider.GetRequiredService<CoverageActivationProcessor>().ProcessAsync(worker, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                // Do not log SDK bodies, documents, credentials, receipt contents or PII.
                logger.LogWarning("Billing activation requires retry. Failure type: {FailureType}", ex.GetType().Name);
            }

            if (!await timer.WaitForNextTickAsync(stoppingToken))
                break;
        }
    }
}
