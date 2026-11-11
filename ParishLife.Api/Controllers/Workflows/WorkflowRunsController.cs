// Purpose: exposes parish custom workflow runs over HTTP: start, current-step results, process-owner actions, reads, worklist and history.
// Main functions: Start, List, Worklist, Get, Step, Act and History delegate capacity, privacy, concurrency and replay rules to WorkflowRunService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Workflows;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Workflows;

namespace ParishLife.Api.Controllers.Workflows;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}/workflow-runs")]
public class WorkflowRunsController(WorkflowRunService service) : ControllerBase
{
    [HttpPost("~/api/parishes/{parishId:guid}/workflows/{definitionId:guid}/runs")]
    public async Task<ActionResult<Versioned<WorkflowRunDto>>> Start(Guid parishId, Guid definitionId, StartWorkflowRunDto request, CancellationToken ct)
        => Ok(await service.StartAsync(Guard.Id(parishId), Guard.Id(definitionId), request, ct));

    [HttpGet]
    public async Task<ActionResult<Page<Versioned<WorkflowRunDto>>>> List(Guid parishId, CancellationToken ct, Guid? definitionId = null, string? status = null, int size = 25, string? cursor = null)
        => Ok(await service.ListAsync(Guard.Id(parishId), definitionId is { } id ? Guard.Id(id) : null, status, size, cursor, ct));

    [HttpGet("worklist")]
    public async Task<ActionResult<Page<Versioned<WorkflowRunDto>>>> Worklist(Guid parishId, CancellationToken ct, int size = 25, string? cursor = null)
        => Ok(await service.WorklistAsync(Guard.Id(parishId), size, cursor, ct));

    [HttpGet("{runId:guid}")]
    public async Task<ActionResult<Versioned<WorkflowRunDto>>> Get(Guid parishId, Guid runId, CancellationToken ct)
        => Ok(await service.GetAsync(Guard.Id(parishId), Guard.Id(runId), ct));

    [HttpPost("{runId:guid}/steps")]
    public async Task<ActionResult<Versioned<WorkflowRunDto>>> Step(Guid parishId, Guid runId, RecordWorkflowStepDto request, CancellationToken ct)
        => Ok(await service.StepAsync(Guard.Id(parishId), Guard.Id(runId), request, ct));

    [HttpPost("{runId:guid}/actions")]
    public async Task<ActionResult<Versioned<WorkflowRunDto>>> Act(Guid parishId, Guid runId, WorkflowRunActionDto request, CancellationToken ct)
        => Ok(await service.ActAsync(Guard.Id(parishId), Guard.Id(runId), request, ct));

    [HttpGet("{runId:guid}/history")]
    public async Task<ActionResult<Page<WorkflowRunEntryDto>>> History(Guid parishId, Guid runId, CancellationToken ct, int size = 50, string? cursor = null)
        => Ok(await service.HistoryAsync(Guard.Id(parishId), Guard.Id(runId), size, cursor, ct));
}
