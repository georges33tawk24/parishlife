// Purpose: anonymous all-parish directory (X09/D01) over HTTP.
// Main functions: Browse (cacheable name-ordered list) and Nearby (POST body keeps the visitor's point out of URLs; never cached) delegate to
// PublicDirectoryService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Publishing;
using ParishLife.Api.Middleware;
using ParishLife.Api.Services.Publishing;

namespace ParishLife.Api.Controllers.Publishing;

[AllowAnonymous, ApiController, Route("api/public/parishes")]
public class PublicDirectoryController(PublicDirectoryService service) : ControllerBase
{
    [HttpGet, PublicCache]
    public async Task<ActionResult<PublicParishDirectoryDto>> Browse(CancellationToken ct, string? q = null)
        => Ok(await service.BrowseAsync(q, ct));

    [HttpPost("nearby")]
    public async Task<ActionResult<PublicParishDirectoryDto>> Nearby(NearbyParishesDto request, CancellationToken ct)
        => Ok(await service.NearbyAsync(request, ct));
}
