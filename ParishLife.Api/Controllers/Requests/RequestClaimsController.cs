// Purpose: lists the guest requests the signed-in account asked to link (A13) and whether each is still waiting for office review.
// Main function: Mine delegates to RequestClaimService.ListAsync.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Requests;
using ParishLife.Api.Services.Requests;

namespace ParishLife.Api.Controllers.Requests;

[Authorize, ApiController, Route("api/me/request-claims")]
public class RequestClaimsController(RequestClaimService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<RequestClaimDto>>> Mine(CancellationToken ct)
        => Ok(await service.ListAsync(ct));
}
