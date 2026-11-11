// Purpose: exposes the bishop's liturgical calendar versions (X12) over HTTP.
// Main functions: List, Get, Save (create or edit a draft by client-chosen id) and Act (approve, withdraw) delegate to LiturgicalCalendarService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Scheduling;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Scheduling;

namespace ParishLife.Api.Controllers.Scheduling;

[Authorize, ApiController, Route("api/archdioceses/{archdioceseId:guid}/liturgical-calendars")]
public class LiturgicalCalendarController(LiturgicalCalendarService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<Versioned<LiturgicalCalendarDto>>>> List(Guid archdioceseId, CancellationToken ct)
        => Ok(await service.ListAsync(Guard.Id(archdioceseId), ct));

    [HttpGet("{calendarId:guid}")]
    public async Task<ActionResult<Versioned<LiturgicalCalendarDto>>> Get(Guid archdioceseId, Guid calendarId, CancellationToken ct)
        => Ok(await service.GetAsync(Guard.Id(archdioceseId), Guard.Id(calendarId), ct));

    [HttpPut("{calendarId:guid}")]
    public async Task<ActionResult<Versioned<LiturgicalCalendarDto>>> Save(Guid archdioceseId, Guid calendarId, SaveLiturgicalCalendarDto request, CancellationToken ct)
        => Ok(await service.SaveAsync(Guard.Id(archdioceseId), Guard.Id(calendarId), request, ct));

    [HttpPost("{calendarId:guid}/actions")]
    public async Task<ActionResult<Versioned<LiturgicalCalendarDto>>> Act(Guid archdioceseId, Guid calendarId, LiturgicalActionDto request, CancellationToken ct)
        => Ok(await service.ActAsync(Guard.Id(archdioceseId), Guard.Id(calendarId), request, ct));
}
