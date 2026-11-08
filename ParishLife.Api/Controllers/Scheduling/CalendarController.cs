// Purpose: exposes authenticated calendar draft, lifecycle and recurrence operations using explicit response DTOs.
// Main functions: Create, Update, Get, List, Act, Series delegate source, privacy, permission and conditional-write rules to CalendarService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Scheduling;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Scheduling;

namespace ParishLife.Api.Controllers.Scheduling;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}/calendar")]
public class CalendarController(CalendarService service) : ControllerBase
{
    [HttpPost("events")]
    public async Task<ActionResult<CalendarEventDto>> Create(Guid parishId, SaveEventDto request, CancellationToken ct) => Ok(await service.SaveAsync(Guard.Id(parishId), null, request, ct));
    [HttpPut("events/{eventId:guid}")]
    public async Task<ActionResult<CalendarEventDto>> Update(Guid parishId, Guid eventId, SaveEventDto request, CancellationToken ct) => Ok(await service.SaveAsync(Guard.Id(parishId), Guard.Id(eventId), request, ct));
    [HttpGet("events/{eventId:guid}")]
    public async Task<ActionResult<Versioned<CalendarEventDto>>> Get(Guid parishId, Guid eventId, CancellationToken ct) => Ok(await service.GetAsync(Guard.Id(parishId), Guard.Id(eventId), ct));
    [HttpGet("events")]
    public async Task<ActionResult<Page<Versioned<CalendarEventDto>>>> List(Guid parishId, DateTimeOffset start, DateTimeOffset end, CancellationToken ct, int size = 25, string? cursor = null)
        => Ok(await service.ListAsync(Guard.Id(parishId), start, end, size, cursor, ct));
    [HttpPost("events/{eventId:guid}/actions")]
    public async Task<ActionResult<CalendarEventDto>> Act(Guid parishId, Guid eventId, EventActionDto request, CancellationToken ct) => Ok(await service.ActAsync(Guard.Id(parishId), Guard.Id(eventId), request, ct));
    [HttpPost("series")]
    public async Task<ActionResult<IReadOnlyList<CalendarEventDto>>> Series(Guid parishId, CreateSeriesDto request, CancellationToken ct) => Ok(await service.CreateSeriesAsync(Guard.Id(parishId), request, ct));
}
