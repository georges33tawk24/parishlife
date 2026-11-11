// Purpose: exposes a parish's recorded map location to its current MFA managers over HTTP.
// Main functions: Get and Set delegate to ParishLocationService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Organizations;

namespace ParishLife.Api.Controllers.Organizations;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}/location")]
public class ParishLocationController(ParishLocationService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<Versioned<ParishLocationDto>>> Get(Guid parishId, CancellationToken ct)
        => Ok(await service.GetAsync(Guard.Id(parishId), ct));

    [HttpPut]
    public async Task<ActionResult<Versioned<ParishLocationDto>>> Set(Guid parishId, SetParishLocationDto request, CancellationToken ct)
        => Ok(await service.SetAsync(Guard.Id(parishId), request, ct));
}
