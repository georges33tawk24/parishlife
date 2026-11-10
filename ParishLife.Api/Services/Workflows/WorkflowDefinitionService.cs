// Purpose: process-owner management of versioned parish custom workflows (W01): a working draft of the form and steps, publication of exactly
// the reviewed draft as an immutable numbered version, and the Open / PausedNew / SafetyStop mode. Requires current MFA, workflows.manage in the
// selected parish capacity and the paid office module; every write fences the parish root and the definition ETag and replays exact retries.
// Main functions: CreateAsync, SaveDraftAsync, PublishAsync, SetModeAsync, GetAsync, ListAsync and VersionAsync (the starter's form preview).

using ParishLife.Api.DTOs.Workflows;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using static ParishLife.Api.Services.Workflows.WorkflowAccess;

namespace ParishLife.Api.Services.Workflows;

public class WorkflowDefinitionService(IRecordTransactions records, WorkflowAccess access, ICurrentActor actor, TimeProvider clock)
{
    public async Task<Versioned<WorkflowDefinitionDto>> CreateAsync(string parish, CreateWorkflowDefinitionDto request, CancellationToken ct)
    {
        var root = await access.RequireAsync(parish, Permissions.WorkflowsManage, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "workflow-create:v1:" + parish);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } prior)
            return await GetAsync(parish, prior.Id, ct);
        var template = ToModel(request.Template);
        WorkflowRules.ValidateTemplate(template);
        var item = new WorkflowDefinition
        {
            Id = op.Id, ParishId = parish, Title = Guard.Text(request.Title, "Title", 200), Draft = template!, Mode = "Open",
            CreatedAt = op.At, CreatedBy = actor.AccountId, UpdatedAt = op.At, UpdatedBy = actor.AccountId
        };
        await records.CommitAsync(Scope(parish), op, "workflow.create", item.Id,
            [Fence(root), RecordChange.Create(DefinitionKey(item.Id), "workflowDefinition", item)], new CommandResult { Id = item.Id, Status = "Created" }, ct);
        return await GetAsync(parish, item.Id, ct);
    }

    public async Task<Versioned<WorkflowDefinitionDto>> SaveDraftAsync(string parish, string id, SaveWorkflowDraftDto request, CancellationToken ct)
    {
        var root = await access.RequireAsync(parish, Permissions.WorkflowsManage, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "workflow-draft:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return await GetAsync(parish, id, ct);
        var row = await access.DefinitionAsync(parish, id, ct);
        if (row.Version != Versions.Require(request.Version))
            throw Conflict("write_conflict", "The workflow changed; reload it before saving.");
        var template = ToModel(request.Template);
        WorkflowRules.ValidateTemplate(template);
        // The draft only affects future publication; published versions and their runs keep what they were started with.
        var item = row.Value;
        item.Title = Guard.Text(request.Title, "Title", 200);
        item.Draft = template!;
        item.UpdatedAt = op.At;
        item.UpdatedBy = actor.AccountId;
        await records.CommitAsync(Scope(parish), op, "workflow.draft", id,
            [Fence(root), RecordChange.Replace(DefinitionKey(id), "workflowDefinition", item, row.Version)], new CommandResult { Id = id, Status = "Saved" }, ct);
        return await GetAsync(parish, id, ct);
    }

    public async Task<WorkflowVersionDto> PublishAsync(string parish, string id, PublishWorkflowDto request, CancellationToken ct)
    {
        var root = await access.RequireAsync(parish, Permissions.WorkflowsManage, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "workflow-publish:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } prior)
            return ToDto(await access.VersionAsync(parish, id, prior.Id, ct));
        var row = await access.DefinitionAsync(parish, id, ct);
        if (row.Version != Versions.Require(request.Version))
            throw Conflict("write_conflict", "The workflow draft changed after it was reviewed; reload it before publishing.");
        WorkflowRules.ValidateTemplate(row.Value.Draft);
        var version = new WorkflowVersion
        {
            Id = op.Id, DefinitionId = id, ParishId = parish, Number = row.Value.PublishedNumber + 1, Title = row.Value.Title,
            Template = row.Value.Draft, DraftVersion = row.Version, PublishedAt = op.At, PublishedBy = actor.AccountId
        };
        var item = row.Value;
        item.PublishedVersionId = version.Id;
        item.PublishedNumber = version.Number;
        item.UpdatedAt = op.At;
        item.UpdatedBy = actor.AccountId;
        await records.CommitAsync(Scope(parish), op, "workflow.publish", id,
            [Fence(root), RecordChange.Replace(DefinitionKey(id), "workflowDefinition", item, row.Version),
             RecordChange.Create(VersionKey(version.Id), "workflowVersion", version)], new CommandResult { Id = version.Id, Status = "Published" }, ct);
        return ToDto(version);
    }

    public async Task<Versioned<WorkflowDefinitionDto>> SetModeAsync(string parish, string id, SetWorkflowModeDto request, CancellationToken ct)
    {
        var root = await access.RequireAsync(parish, Permissions.WorkflowsManage, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "workflow-mode:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return await GetAsync(parish, id, ct);
        var row = await access.DefinitionAsync(parish, id, ct);
        if (row.Version != Versions.Require(request.Version))
            throw Conflict("write_conflict", "The workflow changed; reload it before changing its mode.");
        var mode = WorkflowRules.Modes.FirstOrDefault(m => m == request.Mode?.Trim())
            ?? throw new DomainException("invalid_input", "Use Open, PausedNew or SafetyStop as the workflow mode.");
        if (mode == row.Value.Mode)
            throw Conflict("workflow_mode_unchanged", "The workflow is already in that mode.");
        var item = row.Value;
        item.Mode = mode;
        item.ModeReason = Guard.Text(request.Reason, "Reason", 1000);
        item.UpdatedAt = op.At;
        item.UpdatedBy = actor.AccountId;
        await records.CommitAsync(Scope(parish), op, "workflow.mode", id,
            [Fence(root), RecordChange.Replace(DefinitionKey(id), "workflowDefinition", item, row.Version)], new CommandResult { Id = id, Status = mode }, ct);
        return await GetAsync(parish, id, ct);
    }

    public async Task<Versioned<WorkflowDefinitionDto>> GetAsync(string parish, string id, CancellationToken ct)
    {
        await access.RequireAsync(parish, Permissions.WorkflowsManage, ct);
        var row = await access.DefinitionAsync(parish, id, ct);
        return new Versioned<WorkflowDefinitionDto> { Value = ToDto(row.Value), Version = row.Version };
    }

    public async Task<Page<Versioned<WorkflowDefinitionDto>>> ListAsync(string parish, int size, string? cursor, CancellationToken ct)
    {
        await access.RequireAsync(parish, Permissions.WorkflowsManage, ct);
        var page = await records.PageAsync<WorkflowDefinition>(Scope(parish), "workflowDefinition", Math.Clamp(size, 1, 100), cursor, ct);
        return new Page<Versioned<WorkflowDefinitionDto>>
        {
            Items = page.Items.Where(r => r.Value.ParishId == parish).Select(r => new Versioned<WorkflowDefinitionDto> { Value = ToDto(r.Value), Version = r.Version }).ToArray(),
            ContinuationToken = page.ContinuationToken
        };
    }

    // Process owners, holders of the version's start permission and its step actors may read the published form; nobody else learns it exists.
    public async Task<WorkflowVersionDto> VersionAsync(string parish, string definition, string id, CancellationToken ct)
    {
        var version = await access.VersionAsync(parish, definition, id, ct);
        await access.RequireAnyAsync(parish,
            [Permissions.WorkflowsManage, version.Template.StartPermission, .. version.Template.Steps.Select(s => s.Permission)], ct);
        return ToDto(version);
    }

    private static WorkflowDefinitionDto ToDto(WorkflowDefinition x) => new()
    {
        Id = x.Id, Title = x.Title, Draft = WorkflowAccess.ToDto(x.Draft), PublishedVersionId = x.PublishedVersionId, PublishedNumber = x.PublishedNumber,
        Mode = x.Mode, ModeReason = x.ModeReason, CreatedAt = x.CreatedAt, CreatedBy = x.CreatedBy, UpdatedAt = x.UpdatedAt, UpdatedBy = x.UpdatedBy
    };

    private static WorkflowVersionDto ToDto(WorkflowVersion x) => new()
    {
        Id = x.Id, DefinitionId = x.DefinitionId, Number = x.Number, Title = x.Title, Template = WorkflowAccess.ToDto(x.Template),
        PublishedAt = x.PublishedAt, PublishedBy = x.PublishedBy
    };
}
