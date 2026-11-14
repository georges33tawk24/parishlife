// Purpose: read-only parish audit trail for accounts holding audit.read in that parish.
// Main function: Get returns one bounded page through ParishAuditService; there is no write route.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Administration;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Administration;

namespace ParishLife.Api.Controllers.Administration;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}/audit")]
public class ParishAuditController(ParishAuditService audit) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<Page<AuditEntryDto>>> Get(Guid parishId, CancellationToken ct, int size = 50, string? cursor = null)
        => Ok(await audit.PageAsync(Guard.Id(parishId), size, cursor, ct));
}
