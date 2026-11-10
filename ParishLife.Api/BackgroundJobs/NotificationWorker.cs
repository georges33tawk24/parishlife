// Purpose: resumes bounded durable notification work only when background processing is enabled, using fresh scoped services.
// Main function: ExecuteAsync retains a private page cursor across fifteen-second ticks and logs failure types without recipient/source details.

using ParishLife.Api.Services.Communications;

namespace ParishLife.Api.BackgroundJobs;

internal class NotificationWorker(IServiceScopeFactory scopes, ILogger<NotificationWorker> logger,
    IConfiguration configuration, IHostEnvironment environment) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!configuration.GetValue("BackgroundJobs:Enabled", !environment.IsDevelopment())) return;
        string? cursor = null;
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(15));
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                cursor = await scope.ServiceProvider.GetRequiredService<NotificationProcessor>().ProcessPageAsync(cursor, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception error)
            {
                cursor = null;
                logger.LogWarning("Notification work requires retry. Failure type: {FailureType}", error.GetType().Name);
            }
            try { if (!await timer.WaitForNextTickAsync(stoppingToken)) break; }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
        }
    }
}
