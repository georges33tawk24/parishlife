// Purpose: sends queued outside deliveries (email, push, WhatsApp) only when background processing is enabled and a channel is configured,
// using fresh scoped services.
// Main function: ExecuteAsync keeps a private cursor for notices and one for broadcasts across fifteen-second ticks and logs failure types only.

using ParishLife.Api.Services.Communications;

namespace ParishLife.Api.BackgroundJobs;

internal class DeliveryWorker(IServiceScopeFactory scopes, ILogger<DeliveryWorker> logger, IConfiguration configuration, IHostEnvironment environment)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!configuration.GetValue("BackgroundJobs:Enabled", !environment.IsDevelopment())) return;
        string? notices = null, broadcasts = null;
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(15));
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                if (scope.ServiceProvider.GetRequiredService<DeliveryQueue>().AnyConfigured)
                {
                    var processor = scope.ServiceProvider.GetRequiredService<DeliveryProcessor>();
                    notices = await processor.ProcessNoticesAsync(notices, stoppingToken);
                    broadcasts = await processor.ProcessBroadcastsAsync(broadcasts, stoppingToken);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception error)
            {
                notices = broadcasts = null;
                logger.LogWarning("Outside delivery requires retry. Failure type: {FailureType}", error.GetType().Name);
            }
            try { if (!await timer.WaitForNextTickAsync(stoppingToken)) break; }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
        }
    }
}
