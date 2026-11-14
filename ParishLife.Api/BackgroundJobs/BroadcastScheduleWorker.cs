// Purpose: runs due scheduled broadcasts and broadcast automation runs only when background processing is enabled, using fresh scoped services each minute.
// Main function: ExecuteAsync keeps a private page cursor and logs failure types without recipient or message details.

using ParishLife.Api.Services.Communications;

namespace ParishLife.Api.BackgroundJobs;

internal class BroadcastScheduleWorker(IServiceScopeFactory scopes, ILogger<BroadcastScheduleWorker> logger,
    IConfiguration configuration, IHostEnvironment environment) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!configuration.GetValue("BackgroundJobs:Enabled", !environment.IsDevelopment())) return;
        string? cursor = null;
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                cursor = await scope.ServiceProvider.GetRequiredService<BroadcastScheduleProcessor>().ProcessPageAsync(cursor, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception error)
            {
                cursor = null;
                logger.LogWarning("Broadcast schedule work requires retry. Failure type: {FailureType}", error.GetType().Name);
            }
            try { if (!await timer.WaitForNextTickAsync(stoppingToken)) break; }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
        }
    }
}
