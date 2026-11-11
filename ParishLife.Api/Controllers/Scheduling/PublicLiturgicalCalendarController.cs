// Purpose: anonymous, cacheable read of a parish's approved liturgical observances for display and decoration (X12).
// Main function: Published delegates to LiturgicalCalendarService.PublicAsync.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Scheduling;
using ParishLife.Api.Middleware;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Scheduling;

namespace ParishLife.Api.Controllers.Scheduling;

[AllowAnonymous, ApiController, Route("api/public/parishes/{parishId:guid}/liturgical-calendar")]
public class PublicLiturgicalCalendarController(LiturgicalCalendarService service) : ControllerBase
{
    [HttpGet, PublicCache]
    public async Task<ActionResult<PublicLiturgicalCalendarDto>> Published(Guid parishId, CancellationToken ct, DateOnly? from = null, DateOnly? to = null, string? lang = null)
        => Ok(await service.PublicAsync(Guard.Id(parishId), from, to, lang, ct));
}
