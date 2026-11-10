// Purpose: exposes the permission-scoped parish work overview over HTTP.
// Main function: Overview delegates to WorkOverviewService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Reporting;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Reporting;

namespace ParishLife.Api.Controllers.Reporting;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}/work-overview")]
public class WorkOverviewController(WorkOverviewService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<WorkOverviewDto>> Overview(Guid parishId, CancellationToken ct)
        => Ok(await service.OverviewAsync(Guard.Id(parishId), ct));
}
