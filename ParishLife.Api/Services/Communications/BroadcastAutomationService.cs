// Purpose: manages bounded, explicit broadcast automations for communications staff. An automation names an approved template, a fixed audience,
// a weekly or monthly recurrence and a run limit (1–52); at each due time BroadcastScheduleProcessor creates one broadcast draft from it. Nothing is
// approved, scheduled or sent automatically: each draft still needs a different staff member's approval and someone to store or schedule it.
// Main functions: SaveAsync (create or edit), ActionAsync (pause, resume, end) and ListAsync; helpers keep the due-time work item in step.

using ParishLife.Api.DTOs.Communications;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Ministries;

namespace ParishLife.Api.Services.Communications;

public class BroadcastAutomationService(IRecordTransactions records, BroadcastService broadcasts, MinistryAccess own, ICurrentActor actor, TimeProvider clock)
{
    // Technical bound on live automations per parish, not an agreed parish policy.
    internal const int MaximumLive = 20;
    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    private static string Key(string id) => "broadcastAutomation:" + id;
    private static RecordChange Fence(Versioned<Parish> root) => RecordChange.Replace("parish", "parish", root.Value, root.Version);
    private static DomainException State(string message) => new("invalid_automation_state", message, FailureKind.Conflict);

    public async Task<BroadcastAutomationDto> SaveAsync(string parish, string? id, SaveBroadcastAutomationDto request, CancellationToken ct)
    {
        var root = await broadcasts.StaffAsync(parish, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "broadcast-automation:v1:" + (id ?? "new"));
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } prior)
            return Project((await ReadAsync(parish, prior.Id, ct)).Value);
        var old = id is null ? null : await ReadAsync(parish, id, ct);
        if (old?.Value.Status == "Ended")
            throw State("An ended automation is not edited; create a new one.");
        if (old is null)
        {
            var live = (await records.CollectAsync<BroadcastAutomation>(Scope(parish), "broadcastAutomation", ct, 500)).Count(r => r.Value.Status != "Ended");
            if (live >= MaximumLive)
                throw new DomainException("batch_limit", $"A parish keeps at most {MaximumLive} automations that have not ended; end one first.", FailureKind.Conflict);
        }
        var item = old?.Value ?? new BroadcastAutomation { Id = op.Id, ParishId = parish, CreatedBy = actor.AccountId, CreatedAt = op.At };
        item.Name = Guard.Text(request.Name, "Name", 200);
        item.NameAr = string.IsNullOrWhiteSpace(request.NameAr) ? null : Guard.Text(request.NameAr, "Arabic name", 200);
        var template = (await broadcasts.ReadAsync<BroadcastTemplate>(parish, "broadcastTemplate", Guard.Id(request.TemplateId), t => t.ParishId, t => t.Id, ct)).Value;
        if (template.Status != "Approved")
            throw new DomainException("invalid_broadcast_state", "Only an approved template can be used.", FailureKind.Conflict);
        item.TemplateId = template.Id;
        item.Audience = request.Audience is "Members" or "Ministry" ? request.Audience : throw new DomainException("invalid_input", "Use Members or Ministry.");
        item.MinistryId = item.Audience == "Ministry"
            ? (await own.ReadAsync(parish, Guard.Id(request.MinistryId ?? throw new DomainException("invalid_input", "Choose the ministry audience.")), ct)).Value.Id
            : null;
        item.Recurrence = request.Recurrence is "Weekly" or "Monthly" ? request.Recurrence : throw new DomainException("invalid_input", "Use Weekly or Monthly.");
        var first = Guard.Utc(request.FirstRunAt);
        if (first <= op.At || first > op.At + BroadcastService.ScheduleHorizon)
            throw new DomainException("invalid_input", "Choose a first run time in the future, within a year.");
        if (request.MaxRuns is < 1 or > 52 || request.MaxRuns <= item.RunCount)
            throw new DomainException("invalid_input", "Choose between 1 and 52 runs, more than the runs already made.");
        item.FirstRunAt = first;
        item.NextRunAt = first;
        item.MaxRuns = request.MaxRuns;
        // Whoever saves it becomes responsible for its drafts; that account's access is checked again at every run.
        item.UpdatedBy = actor.AccountId;
        item.UpdatedByAppointmentId = actor.ActingAppointmentId;
        item.UpdatedAt = op.At;
        var changes = new List<RecordChange>
        {
            Fence(root),
            old is null ? RecordChange.Create(Key(item.Id), "broadcastAutomation", item) : RecordChange.Replace(Key(item.Id), "broadcastAutomation", item, Versions.Require(request.Version))
        };
        await WorkChangesAsync(parish, item, changes, ct);
        await records.CommitAsync(Scope(parish), op, "communications.automation_save", item.Id, changes, new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return Project(item);
    }

    public async Task<BroadcastAutomationDto> ActionAsync(string parish, string id, BroadcastAutomationActionDto request, CancellationToken ct)
    {
        var root = await broadcasts.StaffAsync(parish, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "broadcast-automation-action:v1:" + id);
        var row = await ReadAsync(parish, id, ct);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return Project(row.Value);
        var item = row.Value;
        switch (request.Action)
        {
            case "pause" when item.Status == "Active":
                item.Status = "Paused";
                item.StatusReason = null;
                break;
            case "resume" when item.Status == "Paused":
                if (item.RunCount >= item.MaxRuns) throw State("This automation has used all its runs.");
                item.Status = "Active";
                item.StatusReason = null;
                item.NextRunAt = item.Next(op.At);
                item.UpdatedBy = actor.AccountId;
                item.UpdatedByAppointmentId = actor.ActingAppointmentId;
                break;
            case "end" when item.Status is "Active" or "Paused":
                item.Status = "Ended";
                item.StatusReason = null;
                break;
            default:
                throw State("This automation action is not available now.");
        }
        item.UpdatedAt = op.At;
        var changes = new List<RecordChange> { Fence(root), RecordChange.Replace(Key(id), "broadcastAutomation", item, Versions.Require(request.Version)) };
        await WorkChangesAsync(parish, item, changes, ct);
        await records.CommitAsync(Scope(parish), op, "communications.automation_" + request.Action, id, changes, new CommandResult { Id = id, Status = item.Status }, ct);
        return Project(item);
    }

    public async Task<IReadOnlyList<Versioned<BroadcastAutomationDto>>> ListAsync(string parish, CancellationToken ct)
    {
        await broadcasts.StaffAsync(parish, ct);
        return (await records.CollectAsync<BroadcastAutomation>(Scope(parish), "broadcastAutomation", ct, 500))
            .OrderByDescending(r => r.Value.UpdatedAt).Select(r => new Versioned<BroadcastAutomationDto> { Version = r.Version, Value = Project(r.Value) }).ToArray();
    }

    // An Active automation has exactly one work item due at its next run; any other state has none.
    private async Task WorkChangesAsync(string parish, BroadcastAutomation item, List<RecordChange> changes, CancellationToken ct)
    {
        var work = await records.ReadAsync<BroadcastWork>(Scope(parish), BroadcastService.WorkKey(item.Id), ct);
        var due = new BroadcastWork { Id = item.Id, ParishId = parish, Kind = "Automation", TargetId = item.Id, DueAt = item.NextRunAt };
        if (item.Status == "Active")
            changes.Add(work is null ? RecordChange.Create(BroadcastService.WorkKey(item.Id), "broadcastWork", due)
                : RecordChange.Replace(BroadcastService.WorkKey(item.Id), "broadcastWork", due, work.Version));
        else if (work is not null)
            changes.Add(RecordChange.Remove(BroadcastService.WorkKey(item.Id), work.Version));
    }

    private Task<Versioned<BroadcastAutomation>> ReadAsync(string parish, string id, CancellationToken ct)
        => broadcasts.ReadAsync<BroadcastAutomation>(parish, "broadcastAutomation", id, a => a.ParishId, a => a.Id, ct);

    internal static BroadcastAutomationDto Project(BroadcastAutomation x) => new()
    {
        Id = x.Id, Name = x.Name, NameAr = x.NameAr, TemplateId = x.TemplateId, Audience = x.Audience, MinistryId = x.MinistryId, Recurrence = x.Recurrence,
        NextRunAt = x.NextRunAt, MaxRuns = x.MaxRuns, RunCount = x.RunCount, Status = x.Status, StatusReason = x.StatusReason, LastRunAt = x.LastRunAt,
        LastOutcome = x.LastOutcome, LastDraftId = x.LastDraftId, CreatedBy = x.CreatedBy, UpdatedBy = x.UpdatedBy, UpdatedAt = x.UpdatedAt
    };
}
