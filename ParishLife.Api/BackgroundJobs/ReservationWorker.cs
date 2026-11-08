// Purpose: resumes bounded pages of durable reservation work when background processing is explicitly enabled.
// Main function: ExecuteAsync keeps a private continuation across ticks, uses fresh scoped services and logs only safe failure categories.

using ParishLife.Api.Services.Scheduling;

namespace ParishLife.Api.BackgroundJobs;

internal class ReservationWorker(IServiceScopeFactory scopes, ILogger<ReservationWorker> logger,
    IConfiguration configuration, IHostEnvironment environment) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!configuration.GetValue("BackgroundJobs:Enabled", !environment.IsDevelopment())) return;
        var worker = Guid.NewGuid().ToString("N");
        string? cursor = null;
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(15));
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                cursor = await scope.ServiceProvider.GetRequiredService<ReservationProcessor>().ProcessPageAsync(worker, cursor, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception error)
            {
                cursor = null;
                logger.LogWarning("Reservation work requires retry. Failure type: {FailureType}", error.GetType().Name);
            }
            if (!await timer.WaitForNextTickAsync(stoppingToken))
                break;
        }
    }
}
