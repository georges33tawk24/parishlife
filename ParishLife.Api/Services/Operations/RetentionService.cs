// Purpose: automatic deletion of data whose retention period has passed (owner decision, 23 November 2026): notices read or archived more
// than a year ago, and anonymous daily site counts older than two years. Parish records and audit are kept permanently and never touched here;
// unread notices are kept until read.
// Main functions: PurgeNoticesAsync (one bounded page of read/archived notices; returns the next cursor and how many were deleted) and
// PurgeSiteCountsAsync (the days just past the two-year limit, a 60-day window so missed runs catch up). NotificationRetention and
// SiteCountRetention name the periods.

using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Reporting;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Operations;

public class RetentionService(IRecordTransactions records, ISiteMetricStore metrics, TimeProvider clock, ILogger<RetentionService> logger)
{
    public static readonly TimeSpan NotificationRetention = TimeSpan.FromDays(365);
    public const int SiteCountRetentionDays = 730;
    private const int SiteCountWindowDays = 60;

    public async Task<(string? Next, int Deleted)> PurgeNoticesAsync(string? cursor, CancellationToken ct)
    {
        var cutoff = clock.GetUtcNow() - NotificationRetention;
        var page = await records.ScanWorkAsync<Notification>(RecordArea.Account, "notification", 100, cursor, ct);
        var deleted = 0;
        foreach (var row in page.Items.Where(r => r.Value.Status is "Read" or "Archived" && r.Value.ReadAt is { } read && read < cutoff))
        {
            try
            {
                await records.CommitAsync(new RecordScope { Area = RecordArea.Account, OwnerId = row.Value.AccountId },
                    Operation.Create(Guid.NewGuid(), "system:retention", new { Kind = "notification.retention", row.Value.Id }, clock), "notification.retention_deleted",
                    row.Value.Id, [RecordChange.Remove("notification:" + row.Value.Id, row.Version)], new CommandResult { Id = row.Value.Id, Status = "Deleted" }, ct);
                deleted++;
            }
            catch (DomainException) { /* changed meanwhile (e.g. marked unread); the next run looks again */ }
        }
        return (page.ContinuationToken, deleted);
    }

    public async Task<int> PurgeSiteCountsAsync(CancellationToken ct)
    {
        var newestExpired = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime).AddDays(-SiteCountRetentionDays - 1);
        var removed = 0;
        for (var day = newestExpired.AddDays(-SiteCountWindowDays); day <= newestExpired; day = day.AddDays(1))
            removed += await metrics.PurgeDayAsync(day, ct);
        if (removed > 0)
            logger.LogInformation("Retention removed {Count} site count rows older than {Days} days.", removed, SiteCountRetentionDays);
        return removed;
    }
}
