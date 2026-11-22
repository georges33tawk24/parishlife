// Purpose: runs the retention clean-up (RetentionService) a few times a day when background processing is enabled, using fresh scoped services.
// Main function: ExecuteAsync works through read notices page by page (at most 50 pages per run) and the expired site-count days, then waits
// six hours; it logs only counts and failure types.

using ParishLife.Api.Services.Operations;

namespace ParishLife.Api.BackgroundJobs;

internal class RetentionWorker(IServiceScopeFactory scopes, ILogger<RetentionWorker> logger, IConfiguration configuration, IHostEnvironment environment)
    : BackgroundService
{
    private const int PagesPerRun = 50;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!configuration.GetValue("BackgroundJobs:Enabled", !environment.IsDevelopment())) return;
        using var timer = new PeriodicTimer(TimeSpan.FromHours(6));
        string? cursor = null;
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                var retention = scope.ServiceProvider.GetRequiredService<RetentionService>();
                var deleted = 0;
                for (var page = 0; page < PagesPerRun; page++)
                {
                    (cursor, var count) = await retention.PurgeNoticesAsync(cursor, stoppingToken);
                    deleted += count;
                    if (cursor is null) break;
                }
                if (deleted > 0)
                    logger.LogInformation("Retention deleted {Count} notices read more than a year ago.", deleted);
                await retention.PurgeSiteCountsAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception error)
            {
                cursor = null;
                logger.LogWarning("Retention clean-up requires retry. Failure type: {FailureType}", error.GetType().Name);
            }
            try { if (!await timer.WaitForNextTickAsync(stoppingToken)) break; }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
        }
    }
}
