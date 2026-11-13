// Purpose: exposes dated maintenance blocks on rooms and spaces, which hold the room through the reservation resource guards.
// Main functions: Create, List, Get and Act delegate access, conflict and release rules to MaintenanceService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Scheduling;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Scheduling;

namespace ParishLife.Api.Controllers.Scheduling;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}/maintenance-blocks")]
public class MaintenanceController(MaintenanceService service) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<MaintenanceBlockDto>> Create(Guid parishId, MaintenanceDto request, CancellationToken ct)
        => Ok(await service.ScheduleAsync(Guard.Id(parishId), request, ct));
    [HttpGet]
    public async Task<ActionResult<Page<Versioned<MaintenanceBlockDto>>>> List(Guid parishId, DateTimeOffset start, DateTimeOffset end, CancellationToken ct, int size = 25, string? cursor = null)
        => Ok(await service.ListAsync(Guard.Id(parishId), start, end, size, cursor, ct));
    [HttpGet("{blockId:guid}")]
    public async Task<ActionResult<Versioned<MaintenanceBlockDto>>> Get(Guid parishId, Guid blockId, CancellationToken ct)
        => Ok(await service.GetAsync(Guard.Id(parishId), Guard.Id(blockId), ct));
    [HttpPost("{blockId:guid}/actions")]
    public async Task<ActionResult<MaintenanceBlockDto>> Act(Guid parishId, Guid blockId, MaintenanceActionDto request, CancellationToken ct)
        => Ok(await service.ActAsync(Guard.Id(parishId), Guard.Id(blockId), request, ct));
}
