// Purpose: exposes the jurisdiction bishop's parish suspension, reinstatement and closure, and the owner's office coverage view, over HTTP.
// Main functions: Change and History delegate to ParishStatusService; OfficeCoverage delegates to OfficeCoverageService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Organizations;

namespace ParishLife.Api.Controllers.Organizations;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}")]
public class ParishStatusController(ParishStatusService service, OfficeCoverageService coverage) : ControllerBase
{
    [HttpPost("status")]
    public async Task<ActionResult<ParishStatusChangeDto>> Change(Guid parishId, ParishStatusActionDto request, CancellationToken ct)
        => Ok(await service.ChangeAsync(Guard.Id(parishId), request, ct));

    [HttpGet("status/history")]
    public async Task<ActionResult<IReadOnlyList<ParishStatusChangeDto>>> History(Guid parishId, CancellationToken ct)
        => Ok(await service.HistoryAsync(Guard.Id(parishId), ct));

    [HttpGet("office/coverage")]
    public async Task<ActionResult<OfficeCoverageDto>> OfficeCoverage(Guid parishId, CancellationToken ct)
        => Ok(await coverage.CoverageAsync(Guard.Id(parishId), ct));
}
