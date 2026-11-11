// Purpose: exposes parish custom workflow definitions (versioned form + steps) over HTTP for process owners and the starter's form preview.
// Main functions: Create, List, Get, SaveDraft, Publish, SetMode and Version delegate scope, capacity, concurrency and replay rules to WorkflowDefinitionService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Workflows;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Workflows;

namespace ParishLife.Api.Controllers.Workflows;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}/workflows")]
public class WorkflowDefinitionsController(WorkflowDefinitionService service) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<Versioned<WorkflowDefinitionDto>>> Create(Guid parishId, CreateWorkflowDefinitionDto request, CancellationToken ct)
        => Ok(await service.CreateAsync(Guard.Id(parishId), request, ct));

    [HttpGet]
    public async Task<ActionResult<Page<Versioned<WorkflowDefinitionDto>>>> List(Guid parishId, CancellationToken ct, int size = 25, string? cursor = null)
        => Ok(await service.ListAsync(Guard.Id(parishId), size, cursor, ct));

    [HttpGet("{definitionId:guid}")]
    public async Task<ActionResult<Versioned<WorkflowDefinitionDto>>> Get(Guid parishId, Guid definitionId, CancellationToken ct)
        => Ok(await service.GetAsync(Guard.Id(parishId), Guard.Id(definitionId), ct));

    [HttpPut("{definitionId:guid}")]
    public async Task<ActionResult<Versioned<WorkflowDefinitionDto>>> SaveDraft(Guid parishId, Guid definitionId, SaveWorkflowDraftDto request, CancellationToken ct)
        => Ok(await service.SaveDraftAsync(Guard.Id(parishId), Guard.Id(definitionId), request, ct));

    [HttpPost("{definitionId:guid}/publish")]
    public async Task<ActionResult<WorkflowVersionDto>> Publish(Guid parishId, Guid definitionId, PublishWorkflowDto request, CancellationToken ct)
        => Ok(await service.PublishAsync(Guard.Id(parishId), Guard.Id(definitionId), request, ct));

    [HttpPost("{definitionId:guid}/mode")]
    public async Task<ActionResult<Versioned<WorkflowDefinitionDto>>> SetMode(Guid parishId, Guid definitionId, SetWorkflowModeDto request, CancellationToken ct)
        => Ok(await service.SetModeAsync(Guard.Id(parishId), Guard.Id(definitionId), request, ct));

    [HttpGet("{definitionId:guid}/versions/{versionId:guid}")]
    public async Task<ActionResult<WorkflowVersionDto>> Version(Guid parishId, Guid definitionId, Guid versionId, CancellationToken ct)
        => Ok(await service.VersionAsync(Guard.Id(parishId), Guard.Id(definitionId), Guard.Id(versionId), ct));
}
