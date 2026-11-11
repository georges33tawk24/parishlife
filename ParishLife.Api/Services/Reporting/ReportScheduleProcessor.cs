// Purpose: runs due report schedules without a browser identity. At each run it re-authorizes the recipient (active verified MFA account,
// open parish, current direct grant per queue) and, in one account-partition transaction keyed to the schedule and due time, stores the in-app
// snapshot, its notice and the advanced schedule. A recipient without access gets a NotAuthorized delivery without contents and the schedule
// pauses. External email is recorded as NotConfigured; nothing is sent. Missed runs are not backfilled.
// Main functions: RunAsync processes one schedule exactly once per due time; ProcessPageAsync scans active schedules page by page.

using System.Security.Cryptography;
using System.Text;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Services.Reporting;

public class ReportScheduleProcessor(IRecordTransactions records, WorkOverviewService overview, IParishRepository parishes, MfaAccountAccess proof,
    TimeProvider clock, ILogger<ReportScheduleProcessor> logger)
{
    internal const string Topic = "reports";

    public async Task<bool> RunAsync(string account, string id, CancellationToken ct)
    {
        var scope = new RecordScope { Area = RecordArea.Account, OwnerId = account };
        var row = await records.ReadAsync<ReportSchedule>(scope, ReportScheduleService.Key(id), ct);
        var now = clock.GetUtcNow();
        if (row is null || row.Value.Id != id || row.Value.AccountId != account || row.Value.Status != "Active" || row.Value.NextRunAt > now)
            return false;
        var schedule = row.Value;
        var deliveryId = new Guid(SHA256.HashData(Encoding.UTF8.GetBytes("report-delivery\n" + id + "\n" + schedule.NextRunAt.UtcTicks)).AsSpan(0, 16));
        var op = Operation.Create(deliveryId, "system:reports", new { schedule = id, due = schedule.NextRunAt }, clock, "report-delivery:v1");
        if (await records.ReplayAsync<CommandResult>(scope, op, ct) is not null)
            return false;

        var counts = await CountsAsync(account, schedule.ParishId, now, ct);
        var authorized = counts.Count > 0;
        var delivery = new ReportDelivery
        {
            Id = op.Id, ScheduleId = id, AccountId = account, Report = schedule.Report, ParishId = schedule.ParishId, ScheduledFor = schedule.NextRunAt,
            ProducedAt = now, Status = authorized ? "StoredInApp" : "NotAuthorized", Counts = counts,
            ExternalChannel = schedule.EmailRequested ? "Email" : null, ExternalStatus = schedule.EmailRequested ? ReportScheduleService.EmailNotConfigured : null
        };
        schedule.LastRunAt = now;
        schedule.UpdatedAt = now;
        schedule.NextRunAt = ReportScheduleService.Next(schedule, now);
        if (!authorized)
        {
            schedule.Status = "Paused";
            schedule.StatusReason = "You no longer have access to this report; resume after access is restored.";
        }
        var changes = new List<RecordChange>
        {
            RecordChange.Create("reportDelivery:" + delivery.Id, "reportDelivery", delivery),
            RecordChange.Replace(ReportScheduleService.Key(id), "reportSchedule", schedule, row.Version)
        };
        // A ready report is an optional notice the recipient may mute; a pause caused by lost access is always shown.
        var muted = (await records.ReadAsync<NotificationPreferences>(scope, "notificationPreferences", ct))?.Value.MutedTopics.Contains(Topic) == true;
        if (!authorized || !muted)
            changes.Add(RecordChange.Create("notification:" + delivery.Id, "notification", new Notification
            {
                Id = delivery.Id, AccountId = account, ParishId = schedule.ParishId, Kind = authorized ? "Optional" : "Required", Topic = Topic, CreatedAt = now,
                Title = authorized ? "Your scheduled parish work overview is ready." : "A scheduled report was paused because your access changed.",
                Link = authorized ? "/api/report-deliveries/" + delivery.Id : "/api/report-schedules/" + id
            }));
        await records.CommitAsync(scope, op, "report.delivered", delivery.Id, changes, new CommandResult { Id = delivery.Id, Status = delivery.Status }, ct);
        return true;
    }

    public async Task<string?> ProcessPageAsync(string? cursor, CancellationToken ct)
    {
        var page = await records.ScanWorkAsync<ReportSchedule>(RecordArea.Account, "reportSchedule", 25, cursor, ct);
        foreach (var row in page.Items)
        {
            try { await RunAsync(row.Value.AccountId, row.Value.Id, ct); }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
            catch (Exception error)
            {
                logger.LogWarning("Scheduled report remains due. Failure type: {FailureType}", error.GetType().Name);
            }
        }
        return page.ContinuationToken;
    }

    // Mirrors interactive personal-capacity access: active verified MFA account, parish open for ordinary work, current direct grant.
    private async Task<List<ReportCount>> CountsAsync(string account, string parish, DateTimeOffset now, CancellationToken ct)
    {
        if (!await proof.IsVerifiedMfaAccountAsync(account, ct))
            return [];
        var root = await parishes.GetAsync(parish, ct);
        if (root is null || root.Value.Status is ParishStatus.Closed or ParishStatus.Suspended)
            return [];
        var grant = await parishes.GetGrantAsync(parish, account, ct);
        if (grant is null)
            return [];
        return await overview.CountAsync(parish, permission => Task.FromResult(grant.Permits(permission, now)), ct);
    }
}
