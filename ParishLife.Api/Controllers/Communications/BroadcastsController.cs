// Purpose: exposes parish broadcast templates, broadcasts and recipients' own copies over HTTP; rules live in BroadcastService.
// Main functions: CreateTemplate, UpdateTemplate, TemplateAction, Templates, Create, Update, Act, List, Preview and Mine.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Communications;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Communications;

namespace ParishLife.Api.Controllers.Communications;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}")]
public class BroadcastsController(BroadcastService service) : ControllerBase
{
    [HttpPost("broadcast-templates")]
    public async Task<ActionResult<BroadcastTemplateDto>> CreateTemplate(Guid parishId, SaveBroadcastTemplateDto request, CancellationToken ct)
        => Ok(await service.SaveTemplateAsync(Guard.Id(parishId), null, request, ct));

    [HttpPut("broadcast-templates/{templateId:guid}")]
    public async Task<ActionResult<BroadcastTemplateDto>> UpdateTemplate(Guid parishId, Guid templateId, SaveBroadcastTemplateDto request, CancellationToken ct)
        => Ok(await service.SaveTemplateAsync(Guard.Id(parishId), Guard.Id(templateId), request, ct));

    [HttpPost("broadcast-templates/{templateId:guid}/actions")]
    public async Task<ActionResult<BroadcastTemplateDto>> TemplateAction(Guid parishId, Guid templateId, BroadcastActionDto request, CancellationToken ct)
        => Ok(await service.TemplateActionAsync(Guard.Id(parishId), Guard.Id(templateId), request, ct));

    [HttpGet("broadcast-templates")]
    public async Task<ActionResult<IReadOnlyList<Versioned<BroadcastTemplateDto>>>> Templates(Guid parishId, CancellationToken ct)
        => Ok(await service.TemplatesAsync(Guard.Id(parishId), ct));

    [HttpPost("broadcasts")]
    public async Task<ActionResult<BroadcastDto>> Create(Guid parishId, SaveBroadcastDto request, CancellationToken ct)
        => Ok(await service.SaveAsync(Guard.Id(parishId), null, request, ct));

    [HttpPut("broadcasts/{broadcastId:guid}")]
    public async Task<ActionResult<BroadcastDto>> Update(Guid parishId, Guid broadcastId, SaveBroadcastDto request, CancellationToken ct)
        => Ok(await service.SaveAsync(Guard.Id(parishId), Guard.Id(broadcastId), request, ct));

    [HttpPost("broadcasts/{broadcastId:guid}/actions")]
    public async Task<ActionResult<BroadcastDto>> Act(Guid parishId, Guid broadcastId, BroadcastActionDto request, CancellationToken ct)
        => Ok(await service.ActionAsync(Guard.Id(parishId), Guard.Id(broadcastId), request, ct));

    [HttpGet("broadcasts")]
    public async Task<ActionResult<IReadOnlyList<Versioned<BroadcastDto>>>> List(Guid parishId, CancellationToken ct)
        => Ok(await service.ListAsync(Guard.Id(parishId), ct));

    [HttpGet("broadcasts/{broadcastId:guid}/audience-preview")]
    public async Task<ActionResult<BroadcastAudiencePreviewDto>> Preview(Guid parishId, Guid broadcastId, CancellationToken ct)
        => Ok(await service.PreviewAsync(Guard.Id(parishId), Guard.Id(broadcastId), ct));

    [HttpGet("broadcasts/mine")]
    public async Task<ActionResult<IReadOnlyList<ReceivedBroadcastDto>>> Mine(Guid parishId, CancellationToken ct)
        => Ok(await service.MineAsync(Guard.Id(parishId), ct));
}
