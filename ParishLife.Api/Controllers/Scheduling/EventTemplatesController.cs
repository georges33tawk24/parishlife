// Purpose: exposes a parish's reusable event templates over HTTP under the calendar route.
// Main functions: Create, Update, Act (archive or restore), Get and List delegate permission, validation and versioning to EventTemplateService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Scheduling;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Scheduling;

namespace ParishLife.Api.Controllers.Scheduling;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}/calendar/templates")]
public class EventTemplatesController(EventTemplateService service) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<Versioned<EventTemplateDto>>> Create(Guid parishId, SaveEventTemplateDto request, CancellationToken ct)
        => Ok(await service.SaveAsync(Guard.Id(parishId), null, request, ct));

    [HttpPut("{templateId:guid}")]
    public async Task<ActionResult<Versioned<EventTemplateDto>>> Update(Guid parishId, Guid templateId, SaveEventTemplateDto request, CancellationToken ct)
        => Ok(await service.SaveAsync(Guard.Id(parishId), Guard.Id(templateId), request, ct));

    [HttpPost("{templateId:guid}/actions")]
    public async Task<ActionResult<Versioned<EventTemplateDto>>> Act(Guid parishId, Guid templateId, EventTemplateActionDto request, CancellationToken ct)
        => Ok(await service.ActAsync(Guard.Id(parishId), Guard.Id(templateId), request, ct));

    [HttpGet("{templateId:guid}")]
    public async Task<ActionResult<Versioned<EventTemplateDto>>> Get(Guid parishId, Guid templateId, CancellationToken ct)
        => Ok(await service.GetAsync(Guard.Id(parishId), Guard.Id(templateId), ct));

    [HttpGet]
    public async Task<ActionResult<Page<Versioned<EventTemplateDto>>>> List(Guid parishId, CancellationToken ct, bool includeArchived = false, int size = 25, string? cursor = null)
        => Ok(await service.ListAsync(Guard.Id(parishId), includeArchived, size, cursor, ct));
}
