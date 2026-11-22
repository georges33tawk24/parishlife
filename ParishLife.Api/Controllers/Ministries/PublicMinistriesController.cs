// Purpose: returns approved ministry descriptions to visitors without identifying members or reviewers.
// Main function: List delegates safe publication and coverage projection to MinistryService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.Middleware;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Ministries;

namespace ParishLife.Api.Controllers.Ministries;

[AllowAnonymous, ApiController, Route("api/public/parishes/{parishId:guid}/ministries")]
public class PublicMinistriesController(MinistryService service) : ControllerBase
{
    // Server-cached (PublicReadCache, cleared by any TenantControl write) and 60 s in browsers, so a hidden or unpublished item disappears quickly.
    // Reads no identity, cookie or header: route and query only.
    [HttpGet, PublicCache(60)]
    public async Task<ActionResult<Page<PublicMinistryDto>>> List(Guid parishId, CancellationToken ct, int size = 25, string? cursor = null)
        => Ok(await service.PublicAsync(Guard.Id(parishId), size, cursor, ct));
}
