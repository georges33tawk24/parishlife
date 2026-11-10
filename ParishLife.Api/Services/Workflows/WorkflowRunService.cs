// Purpose: runs of published parish custom workflows (W02). A run pins the published version and answers it was started with, evaluates
// conditional show/require rules and step branches server-side, protects restricted-field answers, and advances one ordered step at a time.
// Main functions: StartAsync (start permission, Open mode, viewed version), StepAsync (current step permission in the selected capacity),
// ActAsync (process-owner pause/resume/cancel/reopen with reason), GetAsync, ListAsync, WorklistAsync and HistoryAsync.
// Every write fences the parish root, the definition (so a safety stop cannot race a step) and the run ETag, appends an immutable history
// row and replays exact retries. A step result is a recorded decision only: no sacrament, signature, payment or notification is performed.

using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using ParishLife.Api.DTOs.Workflows;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using static ParishLife.Api.Services.Workflows.WorkflowAccess;

namespace ParishLife.Api.Services.Workflows;

public class WorkflowRunService(IRecordTransactions records, WorkflowAccess access, ICurrentActor actor, IDataProtectionProvider protection, TimeProvider clock)
{
    private static string Key(string id) => "workflowRun:" + id;
    private static string EntryKey(string id) => "workflowRunEntry:" + id;
    private IDataProtector Protector(string parish, string run) => protection.CreateProtector("ParishLife.WorkflowAnswers.v1", parish, run);
    private static readonly string[] Terminal = ["Completed", "Declined", "Cancelled"];

    public async Task<Versioned<WorkflowRunDto>> StartAsync(string parish, string definitionId, StartWorkflowRunDto request, CancellationToken ct)
    {
        var definition = await access.DefinitionAsync(parish, definitionId, ct);
        var version = await access.VersionAsync(parish, definitionId, definition.Value.PublishedVersionId ?? throw Missing(), ct);
        var root = await access.RequireAsync(parish, version.Template.StartPermission, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "workflow-run:v1:" + definitionId);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } prior)
            return await GetAsync(parish, prior.Id, ct);
        if (definition.Value.Mode != "Open")
            throw Conflict("workflow_paused", "This workflow is not accepting new runs; contact its process owner.");
        if (Guard.Id(request.VersionId) != version.Id)
            throw Conflict("workflow_version_changed", "The workflow has a newer published version. Read it and review its questions before starting again.");
        if (request.Answers is null)
            throw new DomainException("invalid_input", "Answers are required.");
        RegistrationRules.ValidateAnswers(version.Template.Fields, request.Answers);
        var restrictedKeys = version.Template.RestrictedFieldKeys;
        var given = request.Answers.Where(a => !string.IsNullOrEmpty(a.Value)).ToDictionary(a => a.Key, a => a.Value, StringComparer.Ordinal);
        var restricted = given.Where(a => restrictedKeys.Contains(a.Key, StringComparer.Ordinal)).ToDictionary(a => a.Key, a => a.Value);
        var steps = version.Template.Steps.Select(s => new WorkflowRunStep
        {
            Key = s.Key, Title = s.Title, Permission = s.Permission, ViewsRestricted = s.ViewsRestricted,
            Status = WorkflowRules.Applies(s, given) ? "Pending" : "Skipped"
        }).ToArray();
        var first = steps.First(s => s.Status == "Pending");
        var run = new WorkflowRun
        {
            Id = op.Id, ParishId = parish, DefinitionId = definitionId, VersionId = version.Id, VersionNumber = version.Number, Title = version.Title,
            StartPermission = version.Template.StartPermission, Status = "InProgress", Cycle = 1, CurrentStepKey = first.Key, CurrentStepPermission = first.Permission,
            Answers = given.Where(a => !restricted.ContainsKey(a.Key)).ToDictionary(a => a.Key, a => a.Value),
            ProtectedRestrictedAnswers = restricted.Count == 0 ? null : Protector(parish, op.Id).Protect(JsonSerializer.Serialize(restricted)),
            RestrictedFieldKeys = [.. restrictedKeys], Steps = steps, StartedAt = op.At, StartedBy = actor.AccountId, UpdatedAt = op.At, UpdatedBy = actor.AccountId
        };
        await records.CommitAsync(Scope(parish), op, "workflow.run_start", run.Id,
            [Fence(root), Fence(definition), RecordChange.Create(Key(run.Id), "workflowRun", run), Entry(op, run, "Started", first.Key, null, null)],
            new CommandResult { Id = run.Id, Status = run.Status }, ct);
        return await GetAsync(parish, run.Id, ct);
    }

    public async Task<Versioned<WorkflowRunDto>> StepAsync(string parish, string id, RecordWorkflowStepDto request, CancellationToken ct)
    {
        var row = await ReadAsync(parish, id, ct);
        var permission = row.Value.Steps.FirstOrDefault(s => s.Key == request.StepKey)?.Permission ?? throw Missing();
        var root = await access.RequireAsync(parish, permission, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "workflow-step:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return await GetAsync(parish, id, ct);
        if (row.Version != Versions.Require(request.Version))
            throw Conflict("write_conflict", "The run changed; reload it before recording this step.");
        var run = row.Value;
        if (run.Status != "InProgress")
            throw Conflict("workflow_run_state", "Only a run in progress can advance.");
        if (run.CurrentStepKey != request.StepKey)
            throw Conflict("workflow_step_not_current", "Only the current step can be recorded.");
        var definition = await access.DefinitionAsync(parish, run.DefinitionId, ct);
        if (definition.Value.Mode == "SafetyStop")
            throw Conflict("workflow_safety_stop", "This workflow is safety-stopped; no run may advance until its process owner reopens it.");
        var result = request.Result?.Trim() is "Completed" or "Declined" ? request.Result.Trim()
            : throw new DomainException("invalid_input", "Use Completed or Declined as the step result.");
        var note = string.IsNullOrWhiteSpace(request.Note) ? null : Guard.Text(request.Note, "Note", 2000);
        if (result == "Declined" && note is null)
            throw new DomainException("invalid_input", "A reason is required to decline a step.");
        var from = run.Status;
        var step = run.Steps.First(s => s.Key == request.StepKey);
        step.Status = result;
        step.CompletedBy = actor.AccountId;
        step.CompletedAt = op.At;
        step.Note = note;
        if (result == "Declined")
        {
            // The declining step stays current so a reviewed reopening resumes exactly there.
            run.Status = "Declined";
            run.ClosedAt = op.At;
        }
        else if (run.Steps.SkipWhile(s => s.Key != step.Key).Skip(1).FirstOrDefault(s => s.Status == "Pending") is { } next)
        {
            run.CurrentStepKey = next.Key;
            run.CurrentStepPermission = next.Permission;
        }
        else
        {
            run.Status = "Completed";
            run.ClosedAt = op.At;
            run.CurrentStepKey = null;
            run.CurrentStepPermission = null;
        }
        run.UpdatedAt = op.At;
        run.UpdatedBy = actor.AccountId;
        await records.CommitAsync(Scope(parish), op, "workflow.run_step", id,
            [Fence(root), Fence(definition), RecordChange.Replace(Key(id), "workflowRun", run, row.Version), Entry(op, run, "Step" + result, step.Key, from, note)],
            new CommandResult { Id = id, Status = run.Status }, ct);
        return await GetAsync(parish, id, ct);
    }

    public async Task<Versioned<WorkflowRunDto>> ActAsync(string parish, string id, WorkflowRunActionDto request, CancellationToken ct)
    {
        var root = await access.RequireAsync(parish, Permissions.WorkflowsManage, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "workflow-run-action:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return await GetAsync(parish, id, ct);
        var row = await ReadAsync(parish, id, ct);
        if (row.Version != Versions.Require(request.Version))
            throw Conflict("write_conflict", "The run changed; reload it before acting on it.");
        var reason = Guard.Text(request.Reason, "Reason", 1000);
        var definition = await access.DefinitionAsync(parish, row.Value.DefinitionId, ct);
        var run = row.Value;
        var from = run.Status;
        var action = request.Action?.Trim();
        string entry;
        switch (action)
        {
            case "pause" when from == "InProgress":
                run.Status = "Paused"; entry = "Paused";
                break;
            case "cancel" when from is "InProgress" or "Paused":
                // Cancelling records the decision only; it never reverses an outcome produced elsewhere.
                run.Status = "Cancelled"; run.ClosedAt = op.At; entry = "Cancelled";
                break;
            case "resume" when from == "Paused":
            case "reopen" when Terminal.Contains(from):
                if (definition.Value.Mode == "SafetyStop")
                    throw Conflict("workflow_safety_stop", "This workflow is safety-stopped; resume it before continuing runs.");
                if (action == "reopen")
                {
                    // A reopened run redoes the step where it ended; earlier results remain in the immutable history, not restored approval.
                    var target = run.Steps.FirstOrDefault(s => s.Key == run.CurrentStepKey) ?? run.Steps.Last(s => s.Status == "Completed");
                    target.Status = "Pending"; target.CompletedBy = null; target.CompletedAt = null; target.Note = null;
                    run.CurrentStepKey = target.Key; run.CurrentStepPermission = target.Permission;
                    run.Cycle++; run.ClosedAt = null; entry = "Reopened";
                }
                else entry = "Resumed";
                run.Status = "InProgress";
                break;
            case "pause" or "cancel" or "resume" or "reopen":
                throw Conflict("workflow_run_state", "That action is not available in the run's current status.");
            default:
                throw new DomainException("invalid_input", "Use pause, resume, cancel or reopen.");
        }
        run.UpdatedAt = op.At;
        run.UpdatedBy = actor.AccountId;
        await records.CommitAsync(Scope(parish), op, "workflow.run_" + action, id,
            [Fence(root), Fence(definition), RecordChange.Replace(Key(id), "workflowRun", run, row.Version), Entry(op, run, entry, run.CurrentStepKey, from, reason)],
            new CommandResult { Id = id, Status = run.Status }, ct);
        return await GetAsync(parish, id, ct);
    }

    public async Task<Versioned<WorkflowRunDto>> GetAsync(string parish, string id, CancellationToken ct)
    {
        var row = await ReadAsync(parish, id, ct);
        var restricted = await ReaderAsync(row.Value, ct);
        return new Versioned<WorkflowRunDto> { Value = Project(row.Value, restricted), Version = row.Version };
    }

    // Process-owner list; like every list, it never carries restricted answers.
    public async Task<Page<Versioned<WorkflowRunDto>>> ListAsync(string parish, string? definitionId, string? status, int size, string? cursor, CancellationToken ct)
    {
        await access.RequireAsync(parish, Permissions.WorkflowsManage, ct);
        var conditions = new List<RecordCondition>();
        if (definitionId is not null) conditions.Add(new RecordCondition { Path = "definitionId", Comparison = "eq", Value = definitionId });
        if (!string.IsNullOrWhiteSpace(status)) conditions.Add(new RecordCondition { Path = "status", Comparison = "eq", Value = status.Trim() });
        var page = await records.PageAsync<WorkflowRun>(Scope(parish), "workflowRun", Math.Clamp(size, 1, 100), cursor, ct, [.. conditions]);
        return Wrap(page, page.Items.Where(r => r.Value.ParishId == parish));
    }

    // The actor's next actions: runs in progress whose current step requires a permission the actor holds now. A page may be short; follow the cursor.
    public async Task<Page<Versioned<WorkflowRunDto>>> WorklistAsync(string parish, int size, string? cursor, CancellationToken ct)
    {
        await access.RequireMfaAsync(ct);
        var page = await records.PageAsync<WorkflowRun>(Scope(parish), "workflowRun", Math.Clamp(size, 1, 100), cursor, ct,
            new RecordCondition { Path = "status", Comparison = "eq", Value = "InProgress" });
        var held = new Dictionary<string, bool>(StringComparer.Ordinal);
        var items = new List<Versioned<WorkflowRun>>();
        foreach (var row in page.Items.Where(r => r.Value.ParishId == parish && r.Value.CurrentStepPermission is not null))
        {
            var permission = row.Value.CurrentStepPermission!;
            if (!held.TryGetValue(permission, out var holds))
                held[permission] = holds = await access.HoldsAsync(parish, permission, ct);
            if (holds) items.Add(row);
        }
        if (items.Count > 0)
            await access.RequireModuleAsync(parish, ct);
        return Wrap(page, items);
    }

    public async Task<Page<WorkflowRunEntryDto>> HistoryAsync(string parish, string id, int size, string? cursor, CancellationToken ct)
    {
        var row = await ReadAsync(parish, id, ct);
        await ReaderAsync(row.Value, ct);
        var page = await records.PageAsync<WorkflowRunEntry>(Scope(parish), "workflowRunEntry", Math.Clamp(size, 1, 100), cursor, ct,
            new RecordCondition { Path = "runId", Comparison = "eq", Value = id });
        return new Page<WorkflowRunEntryDto>
        {
            Items = page.Items.Select(r => r.Value).Where(e => e.ParishId == parish && e.RunId == id).OrderBy(e => e.At).Select(e => new WorkflowRunEntryDto
            {
                Id = e.Id, RunId = e.RunId, Action = e.Action, StepKey = e.StepKey, FromStatus = e.FromStatus, ToStatus = e.ToStatus, Cycle = e.Cycle,
                Reason = e.Reason, By = e.By, ActingAppointmentId = e.ActingAppointmentId, At = e.At
            }).ToArray(),
            ContinuationToken = page.ContinuationToken
        };
    }

    // Readers: process owners; the starter while still holding the start permission; holders of any pinned step permission.
    // Restricted answers: process owners, the starter and holders of a step marked ViewsRestricted. Returns whether restricted answers are visible.
    private async Task<bool> ReaderAsync(WorkflowRun run, CancellationToken ct)
    {
        var held = await access.RequireAnyAsync(run.ParishId, [Permissions.WorkflowsManage, run.StartPermission, .. run.Steps.Select(s => s.Permission)], ct);
        var starter = run.StartedBy == actor.AccountId && held.Contains(run.StartPermission);
        var stepReader = run.Steps.Any(s => held.Contains(s.Permission));
        if (!held.Contains(Permissions.WorkflowsManage) && !starter && !stepReader)
            throw Missing();
        return held.Contains(Permissions.WorkflowsManage) || starter || run.Steps.Any(s => s.ViewsRestricted && held.Contains(s.Permission));
    }

    private async Task<Versioned<WorkflowRun>> ReadAsync(string parish, string id, CancellationToken ct)
        => await records.ReadAsync<WorkflowRun>(Scope(parish), Key(id), ct) is { } row && row.Value.Id == id && row.Value.ParishId == parish ? row : throw Missing();

    private RecordChange Entry(Operation op, WorkflowRun run, string action, string? step, string? from, string? reason)
        => RecordChange.Create(EntryKey(op.Id), "workflowRunEntry", new WorkflowRunEntry
        {
            Id = op.Id, RunId = run.Id, ParishId = run.ParishId, Action = action, StepKey = step, FromStatus = from, ToStatus = run.Status, Cycle = run.Cycle,
            Reason = reason, By = actor.AccountId, ActingAppointmentId = actor.ActingAppointmentId, At = op.At
        });

    private Page<Versioned<WorkflowRunDto>> Wrap(Page<Versioned<WorkflowRun>> page, IEnumerable<Versioned<WorkflowRun>> rows) => new()
    {
        Items = rows.Select(r => new Versioned<WorkflowRunDto> { Value = Project(r.Value, false), Version = r.Version }).ToArray(),
        ContinuationToken = page.ContinuationToken
    };

    private WorkflowRunDto Project(WorkflowRun x, bool restricted)
    {
        var answers = new Dictionary<string, string>(x.Answers, StringComparer.Ordinal);
        if (restricted && x.ProtectedRestrictedAnswers is { } sealedAnswers)
            foreach (var pair in JsonSerializer.Deserialize<Dictionary<string, string>>(Protector(x.ParishId, x.Id).Unprotect(sealedAnswers)) ?? [])
                answers[pair.Key] = pair.Value;
        return new WorkflowRunDto
        {
            Id = x.Id, DefinitionId = x.DefinitionId, VersionId = x.VersionId, VersionNumber = x.VersionNumber, Title = x.Title, Status = x.Status, Cycle = x.Cycle,
            CurrentStepKey = x.CurrentStepKey, Answers = answers, RedactedFieldKeys = restricted ? [] : [.. x.RestrictedFieldKeys],
            Steps = x.Steps.Select(s => new WorkflowRunStepDto
            {
                Key = s.Key, Title = s.Title, Permission = s.Permission, Status = s.Status, CompletedBy = s.CompletedBy, CompletedAt = s.CompletedAt, Note = s.Note
            }).ToArray(),
            StartedAt = x.StartedAt, StartedBy = x.StartedBy, UpdatedAt = x.UpdatedAt, UpdatedBy = x.UpdatedBy, ClosedAt = x.ClosedAt
        };
    }
}
