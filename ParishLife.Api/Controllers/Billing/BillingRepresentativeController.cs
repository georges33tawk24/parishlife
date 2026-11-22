// Purpose: HTTP endpoints for an archdiocese's named billing representative.
// Main functions: Get (the bishop or the current representative) and Set (bishop only) delegate to BillingRepresentativeService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Billing;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Billing;

namespace ParishLife.Api.Controllers.Billing;

[Authorize, ApiController, Route("api/archdioceses/{archdioceseId:guid}/billing-representative")]
public class BillingRepresentativeController(BillingRepresentativeService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<BillingRepresentativeDto>> Get(Guid archdioceseId, CancellationToken ct)
        => Ok(await service.GetAsync(Guard.Id(archdioceseId), ct));

    [HttpPut]
    public async Task<ActionResult<BillingRepresentativeDto>> Set(Guid archdioceseId, SetBillingRepresentativeDto request, CancellationToken ct)
        => Ok(await service.SetAsync(Guard.Id(archdioceseId), request, ct));
}
