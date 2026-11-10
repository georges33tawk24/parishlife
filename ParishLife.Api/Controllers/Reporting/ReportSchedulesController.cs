// Purpose: exposes the caller's own report schedules and delivered report snapshots over HTTP.
// Main functions: Create, List, Get, Act, Deliveries and Delivery delegate to ReportScheduleService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Reporting;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Reporting;

namespace ParishLife.Api.Controllers.Reporting;

[Authorize, ApiController, Route("api")]
public class ReportSchedulesController(ReportScheduleService service) : ControllerBase
{
    [HttpPost("report-schedules")]
    public async Task<ActionResult<Versioned<ReportScheduleDto>>> Create(CreateReportScheduleDto request, CancellationToken ct)
        => Ok(await service.CreateAsync(request, ct));

    [HttpGet("report-schedules")]
    public async Task<ActionResult<Page<Versioned<ReportScheduleDto>>>> List(CancellationToken ct, int size = 25, string? cursor = null)
        => Ok(await service.ListAsync(size, cursor, ct));

    [HttpGet("report-schedules/{id:guid}")]
    public async Task<ActionResult<Versioned<ReportScheduleDto>>> Get(Guid id, CancellationToken ct)
        => Ok(await service.GetAsync(Guard.Id(id), ct));

    [HttpPost("report-schedules/{id:guid}/actions")]
    public async Task<ActionResult<Versioned<ReportScheduleDto>>> Act(Guid id, ReportScheduleActionDto request, CancellationToken ct)
        => Ok(await service.ActAsync(Guard.Id(id), request, ct));

    [HttpGet("report-deliveries")]
    public async Task<ActionResult<Page<ReportDeliveryDto>>> Deliveries(CancellationToken ct, int size = 25, string? cursor = null)
        => Ok(await service.DeliveriesAsync(size, cursor, ct));

    [HttpGet("report-deliveries/{id:guid}")]
    public async Task<ActionResult<ReportDeliveryDto>> Delivery(Guid id, CancellationToken ct)
        => Ok(await service.DeliveryAsync(Guard.Id(id), ct));
}
