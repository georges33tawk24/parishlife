// Purpose: runs due report schedules only when background processing is enabled, using fresh scoped services each minute.
// Main function: ExecuteAsync keeps a private page cursor and logs failure types without recipient or report details.

using ParishLife.Api.Services.Reporting;

namespace ParishLife.Api.BackgroundJobs;

internal class ReportScheduleWorker(IServiceScopeFactory scopes, ILogger<ReportScheduleWorker> logger,
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
                cursor = await scope.ServiceProvider.GetRequiredService<ReportScheduleProcessor>().ProcessPageAsync(cursor, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception error)
            {
                cursor = null;
                logger.LogWarning("Scheduled report work requires retry. Failure type: {FailureType}", error.GetType().Name);
            }
            try { if (!await timer.WaitForNextTickAsync(stoppingToken)) break; }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
        }
    }
}
