// Purpose: exposes parish broadcast automations to communications staff over HTTP; rules live in BroadcastAutomationService.
// Main functions: Create, Update, Act (pause, resume, end) and List.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Communications;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Communications;

namespace ParishLife.Api.Controllers.Communications;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}/broadcast-automations")]
public class BroadcastAutomationsController(BroadcastAutomationService service) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<BroadcastAutomationDto>> Create(Guid parishId, SaveBroadcastAutomationDto request, CancellationToken ct)
        => Ok(await service.SaveAsync(Guard.Id(parishId), null, request, ct));

    [HttpPut("{automationId:guid}")]
    public async Task<ActionResult<BroadcastAutomationDto>> Update(Guid parishId, Guid automationId, SaveBroadcastAutomationDto request, CancellationToken ct)
        => Ok(await service.SaveAsync(Guard.Id(parishId), Guard.Id(automationId), request, ct));

    [HttpPost("{automationId:guid}/actions")]
    public async Task<ActionResult<BroadcastAutomationDto>> Act(Guid parishId, Guid automationId, BroadcastAutomationActionDto request, CancellationToken ct)
        => Ok(await service.ActionAsync(Guard.Id(parishId), Guard.Id(automationId), request, ct));

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<Versioned<BroadcastAutomationDto>>>> List(Guid parishId, CancellationToken ct)
        => Ok(await service.ListAsync(Guard.Id(parishId), ct));
}
