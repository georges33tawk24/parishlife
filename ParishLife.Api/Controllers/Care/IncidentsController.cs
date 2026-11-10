// Purpose: exposes restricted incident recording and handling over HTTP.
// Main functions: Record, Act, Get and List delegate rules to IncidentService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Care;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Care;

namespace ParishLife.Api.Controllers.Care;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}/incidents")]
public class IncidentsController(IncidentService service) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<IncidentReceiptDto>> Record(Guid parishId, RecordIncidentDto request, CancellationToken ct)
        => Ok(await service.RecordAsync(Guard.Id(parishId), request, ct));

    [HttpPost("{incidentId:guid}/actions")]
    public async Task<ActionResult<IncidentDto>> Act(Guid parishId, Guid incidentId, IncidentActionDto request, CancellationToken ct)
        => Ok(await service.ActAsync(Guard.Id(parishId), Guard.Id(incidentId), request, ct));

    [HttpGet("{incidentId:guid}")]
    public async Task<ActionResult<Versioned<IncidentDto>>> Get(Guid parishId, Guid incidentId, CancellationToken ct)
        => Ok(await service.GetAsync(Guard.Id(parishId), Guard.Id(incidentId), ct));

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<Versioned<IncidentDto>>>> List(Guid parishId, CancellationToken ct, string? status = null, Guid? eventId = null)
        => Ok(await service.ListAsync(Guard.Id(parishId), status, eventId is { } e ? Guard.Id(e) : null, ct));
}
