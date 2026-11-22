// Purpose: exposes explicitly published manual public activities and cancellation notices without private event or account fields.
// Main function: List delegates bounded window/pagination and publication-state filtering to CalendarService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.Middleware;
using ParishLife.Api.DTOs.Scheduling;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Scheduling;

namespace ParishLife.Api.Controllers.Scheduling;

[AllowAnonymous, ApiController, Route("api/public/parishes/{parishId:guid}/calendar")]
public class PublicCalendarController(CalendarService service) : ControllerBase
{
    // Server-cached (PublicReadCache, cleared by any TenantControl write) and 60 s in browsers, so a hidden or unpublished item disappears quickly.
    // Reads no identity, cookie or header: route and query only.
    [HttpGet, PublicCache(60)]
    public async Task<ActionResult<Page<PublicCalendarEventDto>>> List(Guid parishId, DateTimeOffset start, DateTimeOffset end, CancellationToken ct, int size = 25, string? cursor = null)
        => Ok(await service.PublicAsync(Guard.Id(parishId), start, end, size, cursor, ct));
}
