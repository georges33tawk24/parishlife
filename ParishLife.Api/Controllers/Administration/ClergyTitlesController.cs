// Purpose: the operator-maintained clergy title list (read by any signed-in account) and the title assigned to an account.
// Main functions: List, Create, Update, Assignment and Assign delegate authority, versions and audit to ClergyTitleService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Administration;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Administration;

namespace ParishLife.Api.Controllers.Administration;

[Authorize, ApiController, Route("api/clergy-titles")]
public class ClergyTitlesController(ClergyTitleService titles) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<Versioned<ClergyTitleDto>>>> List(CancellationToken ct, bool includeRetired = false)
        => Ok(await titles.ListAsync(includeRetired, ct));

    [HttpPost]
    public async Task<ActionResult<Versioned<ClergyTitleDto>>> Create(ClergyTitleSaveDto request, CancellationToken ct)
        => Ok(await titles.CreateAsync(request, ct));

    [HttpPut("{titleId:guid}")]
    public async Task<ActionResult<Versioned<ClergyTitleDto>>> Update(Guid titleId, ClergyTitleSaveDto request, CancellationToken ct)
        => Ok(await titles.UpdateAsync(Guard.Id(titleId), request, ct));

    [HttpGet("accounts/{accountId:guid}")]
    public async Task<ActionResult<Versioned<ClergyTitleAssignmentDto>>> Assignment(Guid accountId, CancellationToken ct)
        => Ok(await titles.AssignmentAsync(Guard.Id(accountId), ct));

    [HttpPut("~/api/administration/accounts/{accountId:guid}/clergy-title")]
    public async Task<ActionResult<Versioned<ClergyTitleAssignmentDto>>> Assign(Guid accountId, ClergyTitleAssignDto request, CancellationToken ct)
        => Ok(await titles.AssignAsync(Guard.Id(accountId), request, ct));
}
