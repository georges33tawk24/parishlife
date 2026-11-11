// Purpose: exposes the bishop's jurisdiction overview and parish map over HTTP.
// Main functions: Overview and Map delegate to BishopOverviewService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Reporting;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Reporting;

namespace ParishLife.Api.Controllers.Reporting;

[Authorize, ApiController, Route("api/archdioceses/{archdioceseId:guid}/overview")]
public class BishopOverviewController(BishopOverviewService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<BishopOverviewDto>> Overview(Guid archdioceseId, [FromQuery] DateTimeOffset from, [FromQuery] DateTimeOffset to, CancellationToken ct)
        => Ok(await service.OverviewAsync(Guard.Id(archdioceseId), from.ToUniversalTime(), to.ToUniversalTime(), ct));

    [HttpGet("map")]
    public async Task<ActionResult<BishopMapDto>> Map(Guid archdioceseId, CancellationToken ct)
        => Ok(await service.MapAsync(Guard.Id(archdioceseId), ct));
}
