// Purpose: runs due broadcast work without a browser identity. A scheduled broadcast is stored for its audience at its time only if the account
// that scheduled it still holds communications access under the same capacity (active verified MFA account, open parish with core coverage, current
// grant or appointment duty without a denial); otherwise it returns to Approved with a note and nothing is stored. An automation run creates one
// broadcast draft from its still-approved template (or records that the previous draft is still waiting), advances to the next due time and ends at
// its run limit. Each due time is processed exactly once (deterministic operation id); missed due times are not backfilled. Nothing is sent
// outside the app.
// Main functions: RunAsync processes one work item; ProcessPageAsync scans pending work page by page; AuthorizedAsync re-checks the capacity.

using System.Security.Cryptography;
using System.Text;
using ParishLife.Api.Authorization;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Services.Communications;

public class BroadcastScheduleProcessor(IRecordTransactions records, IParishRepository parishes, MfaAccountAccess proof, BroadcastAudience audience,
    TimeProvider clock, ILogger<BroadcastScheduleProcessor> logger)
{
    private const string System = "system:broadcasts";
    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };

    public async Task<bool> RunAsync(string parish, string id, CancellationToken ct)
    {
        var work = await records.ReadAsync<BroadcastWork>(Scope(parish), BroadcastService.WorkKey(id), ct);
        var now = clock.GetUtcNow();
        if (work is null || work.Value.Id != id || work.Value.ParishId != parish || work.Value.DueAt > now)
            return false;
        var opId = new Guid(SHA256.HashData(Encoding.UTF8.GetBytes("broadcast-work\n" + work.Value.Kind + "\n" + id + "\n" + work.Value.DueAt.UtcTicks)).AsSpan(0, 16));
        var op = Operation.Create(opId, System, new { work = id, kind = work.Value.Kind, due = work.Value.DueAt }, clock, "broadcast-work:v1");
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return false;
        return work.Value.Kind == "Automation" ? await AutomationAsync(parish, work, op, now, ct) : await SendAsync(parish, work, op, now, ct);
    }

    private async Task<bool> SendAsync(string parish, Versioned<BroadcastWork> work, Operation op, DateTimeOffset now, CancellationToken ct)
    {
        var id = work.Value.TargetId;
        var row = await records.ReadAsync<Broadcast>(Scope(parish), "broadcast:" + id, ct);
        var changes = new List<RecordChange> { RecordChange.Remove(BroadcastService.WorkKey(work.Value.Id), work.Version) };
        // A work item left behind by an unschedule or cancel is only removed.
        if (row is null || row.Value.ParishId != parish || row.Value.Status != "Scheduled" || row.Value.ScheduledFor != work.Value.DueAt)
        {
            await records.CommitAsync(Scope(parish), op, "communications.broadcast_schedule_cleared", id, changes, new CommandResult { Id = id, Status = "Cleared" }, ct);
            return true;
        }
        var item = row.Value;
        var root = await AuthorizedAsync(parish, item.ScheduledBy ?? "", item.ScheduledByAppointmentId, now, ct);
        string? note = root is null ? "Not stored at the scheduled time: the account that scheduled it no longer has communications access in this parish." : null;
        if (root is not null)
        {
            try
            {
                var (recipients, skipped) = await audience.ResolveAsync(parish, item, ct);
                item.RecipientAccountIds = recipients;
                item.SkippedByPreference = skipped;
                item.Status = "Sent";
                item.SentBy = item.ScheduledBy;
                item.SentAt = now;
                item.ScheduleNote = null;
            }
            catch (DomainException error) when (error.Code == "batch_limit")
            {
                note = "Not stored at the scheduled time: " + error.Message;
            }
            changes.Add(RecordChange.Replace("parish", "parish", root.Value, root.Version));
        }
        if (note is not null)
        {
            item.Status = "Approved";
            BroadcastService.ClearSchedule(item);
            item.ScheduleNote = note;
        }
        changes.Add(RecordChange.Replace("broadcast:" + id, "broadcast", item, row.Version));
        await records.CommitAsync(Scope(parish), op, item.Status == "Sent" ? "communications.broadcast_scheduled_send" : "communications.broadcast_schedule_held",
            id, changes, new CommandResult { Id = id, Status = item.Status }, ct);
        return true;
    }

    private async Task<bool> AutomationAsync(string parish, Versioned<BroadcastWork> work, Operation op, DateTimeOffset now, CancellationToken ct)
    {
        var id = work.Value.TargetId;
        var row = await records.ReadAsync<BroadcastAutomation>(Scope(parish), "broadcastAutomation:" + id, ct);
        var changes = new List<RecordChange>();
        if (row is null || row.Value.ParishId != parish || row.Value.Status != "Active" || row.Value.NextRunAt != work.Value.DueAt)
        {
            changes.Add(RecordChange.Remove(BroadcastService.WorkKey(work.Value.Id), work.Version));
            await records.CommitAsync(Scope(parish), op, "communications.automation_work_cleared", id, changes, new CommandResult { Id = id, Status = "Cleared" }, ct);
            return true;
        }
        var item = row.Value;
        var root = await AuthorizedAsync(parish, item.UpdatedBy, item.UpdatedByAppointmentId, now, ct);
        var template = (await records.ReadAsync<BroadcastTemplate>(Scope(parish), "broadcastTemplate:" + item.TemplateId, ct))?.Value;
        if (root is null || template?.Status != "Approved" || template.ParishId != parish)
        {
            item.Status = "Paused";
            item.StatusReason = root is null
                ? "Paused: the staff member responsible no longer has communications access here; another staff member can resume it."
                : "Paused: its template is no longer approved.";
            item.UpdatedAt = now;
            changes.Add(RecordChange.Remove(BroadcastService.WorkKey(work.Value.Id), work.Version));
            changes.Add(RecordChange.Replace("broadcastAutomation:" + id, "broadcastAutomation", item, row.Version));
            await records.CommitAsync(Scope(parish), op, "communications.automation_paused", id, changes, new CommandResult { Id = id, Status = item.Status }, ct);
            return true;
        }
        changes.Add(RecordChange.Replace("parish", "parish", root.Value, root.Version));
        // One waiting draft at a time: if the previous draft was neither sent nor cancelled, this due time adds nothing.
        var previous = item.LastDraftId is null ? null : (await records.ReadAsync<Broadcast>(Scope(parish), "broadcast:" + item.LastDraftId, ct))?.Value;
        if (previous?.Status is "Draft" or "Approved" or "Scheduled")
            item.LastOutcome = "Skipped";
        else
        {
            var draft = new Broadcast
            {
                Id = op.Id, ParishId = parish, Audience = item.Audience, MinistryId = item.MinistryId, AutomationId = item.Id,
                UpdatedBy = item.UpdatedBy, UpdatedAt = now
            };
            BroadcastService.CopyTemplate(draft, template);
            changes.Add(RecordChange.Create("broadcast:" + draft.Id, "broadcast", draft));
            item.LastOutcome = "Drafted";
            item.LastDraftId = draft.Id;
        }
        item.RunCount++;
        item.LastRunAt = now;
        if (item.RunCount >= item.MaxRuns)
        {
            item.Status = "Ended";
            item.StatusReason = "Ended after its last run.";
            changes.Add(RecordChange.Remove(BroadcastService.WorkKey(work.Value.Id), work.Version));
        }
        else
        {
            item.NextRunAt = item.Next(now);
            changes.Add(RecordChange.Replace(BroadcastService.WorkKey(work.Value.Id), "broadcastWork",
                new BroadcastWork { Id = work.Value.Id, ParishId = parish, Kind = "Automation", TargetId = id, DueAt = item.NextRunAt }, work.Version));
        }
        changes.Add(RecordChange.Replace("broadcastAutomation:" + id, "broadcastAutomation", item, row.Version));
        await records.CommitAsync(Scope(parish), op, "communications.automation_run", id, changes, new CommandResult { Id = id, Status = item.LastOutcome! }, ct);
        return true;
    }

    public async Task<string?> ProcessPageAsync(string? cursor, CancellationToken ct)
    {
        var page = await records.ScanWorkAsync<BroadcastWork>(RecordArea.Parish, "broadcastWork", 25, cursor, ct);
        foreach (var row in page.Items)
        {
            try { await RunAsync(row.Value.ParishId, row.Value.Id, ct); }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
            catch (Exception error)
            {
                logger.LogWarning("Broadcast work remains due. Failure type: {FailureType}", error.GetType().Name);
            }
        }
        return page.ContinuationToken;
    }

    // Mirrors interactive staff access for the recorded capacity: returns the parish root to fence the commit, or null when access has ended.
    private async Task<Versioned<Parish>?> AuthorizedAsync(string parish, string account, string? appointmentId, DateTimeOffset now, CancellationToken ct)
    {
        if (account.Length == 0 || !await proof.IsVerifiedMfaAccountAsync(account, ct))
            return null;
        var root = await parishes.GetAsync(parish, ct);
        if (root is null || root.Value.Status is ParishStatus.Closed or ParishStatus.Suspended || root.Value.Status != ParishStatus.Verified
            || !(await parishes.GetCoveragesAsync(parish, ct)).Any(c => c.Includes("core", now)))
            return null;
        var grant = await parishes.GetGrantAsync(parish, account, ct);
        if (appointmentId is null)
            return grant?.Permits(Permissions.CommunicationsManage, now) == true ? root : null;
        var appointment = (await records.ReadAsync<StaffAppointment>(StaffAppointmentAccess.Scope("", parish), StaffAppointmentAccess.Key(appointmentId), ct))?.Value;
        if (appointment is null || appointment.Id != appointmentId || appointment.AccountId != account || appointment.ParishId != parish
            || appointment.ArchdioceseId != root.Value.JurisdictionArchdioceseId
            || (await parishes.GetArchdioceseAsync(appointment.ArchdioceseId, ct))?.Value.Verified != true
            || !appointment.Permits(Permissions.CommunicationsManage, now)
            || grant?.Denies.Contains(Permissions.CommunicationsManage, StringComparer.Ordinal) == true)
            return null;
        return root;
    }
}
