// Purpose: resumes bounded pages of pending required in-app notification obligations without a browser identity or leases.
// Main functions: ProcessOneAsync reloads exact parish work; ProcessPageAsync advances a private continuation and isolates safe failure categories.

using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Communications;

public class NotificationProcessor(IRecordTransactions records, NotificationService notifications, ILogger<NotificationProcessor> logger)
{
    public async Task ProcessOneAsync(string parish, string id, CancellationToken ct)
    {
        var scope = new RecordScope { Area = RecordArea.Parish, OwnerId = parish };
        var row = await records.ReadAsync<NotificationWork>(scope, "notificationWork:" + id, ct);
        if (row is null || row.Value.Id != id || row.Value.ParishId != parish || row.Value.Status != "Pending") return;
        await notifications.DispatchAsync(parish, row.Value.AccountId, row.Value.DedupKey, ct);
    }

    public async Task<string?> ProcessPageAsync(string? cursor, CancellationToken ct)
    {
        var page = await records.ScanWorkAsync<NotificationWork>(RecordArea.Parish, "notificationWork", 25, cursor, ct);
        foreach (var row in page.Items)
        {
            try { await ProcessOneAsync(row.Value.ParishId, row.Value.Id, ct); }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
            catch (Exception error)
            {
                logger.LogWarning("Notification work remains pending. Failure type: {FailureType}", error.GetType().Name);
            }
        }
        return page.ContinuationToken;
    }
}
