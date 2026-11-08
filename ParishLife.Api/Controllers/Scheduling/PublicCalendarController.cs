// Purpose: exposes explicitly published manual public activities and cancellation notices without private event or account fields.
// Main function: List delegates bounded window/pagination and publication-state filtering to CalendarService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Scheduling;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Scheduling;

namespace ParishLife.Api.Controllers.Scheduling;

[AllowAnonymous, ApiController, Route("api/public/parishes/{parishId:guid}/calendar")]
public class PublicCalendarController(CalendarService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<Page<PublicCalendarEventDto>>> List(Guid parishId, DateTimeOffset start, DateTimeOffset end, CancellationToken ct, int size = 25, string? cursor = null)
        => Ok(await service.PublicAsync(Guard.Id(parishId), start, end, size, cursor, ct));
}
