// Purpose: exposes the combined Home and the explicit capacity choice list (D01) for the signed-in account over HTTP.
// Main functions: Home and Capacities delegate to CombinedHomeService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.PersonalWorkspace;
using ParishLife.Api.Services.PersonalWorkspace;

namespace ParishLife.Api.Controllers.PersonalWorkspace;

[Authorize, ApiController, Route("api/me")]
public class CombinedHomeController(CombinedHomeService service) : ControllerBase
{
    [HttpGet("home")]
    public async Task<ActionResult<CombinedHomeDto>> Home(CancellationToken ct) => Ok(await service.HomeAsync(ct));

    [HttpGet("capacities")]
    public async Task<ActionResult<IReadOnlyList<CapacityDto>>> Capacities(CancellationToken ct) => Ok(await service.CapacitiesAsync(ct));
}
