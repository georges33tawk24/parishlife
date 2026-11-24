// Purpose: HTTP endpoints for the archdiocese's sacrament preparation checklists, set by the current bishop for all its parishes.
// Main functions: List and Save (an empty list clears that sacrament's archdiocese checklist; the answer is then empty) delegate to
// ArchdioceseRequirementService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Sacraments;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Sacraments;

namespace ParishLife.Api.Controllers.Sacraments;

[Authorize, ApiController, Route("api/archdioceses/{archdioceseId:guid}/sacrament-requirements")]
public class ArchdioceseRequirementsController(ArchdioceseRequirementService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<RequirementSetDto>>> List(Guid archdioceseId, CancellationToken ct)
        => Ok(await service.ListAsync(Guard.Id(archdioceseId), ct));

    [HttpPut]
    public async Task<ActionResult<RequirementSetDto?>> Save(Guid archdioceseId, SaveRequirementSetDto request, CancellationToken ct)
        => Ok(await service.SaveAsync(Guard.Id(archdioceseId), request, ct));
}
