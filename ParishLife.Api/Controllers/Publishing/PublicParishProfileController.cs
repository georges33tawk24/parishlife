// Purpose: anonymous reads of a verified parish's published profile and its published photographs.
// Main functions: Published (cacheable, 404 until the parish publishes) and Photo (published photos only, short public cache).

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Publishing;
using ParishLife.Api.Middleware;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Publishing;

namespace ParishLife.Api.Controllers.Publishing;

[AllowAnonymous, ApiController, Route("api/public/parishes/{parishId:guid}/profile")]
public class PublicParishProfileController(ParishProfileService service) : ControllerBase
{
    [HttpGet, PublicCache]
    public async Task<ActionResult<PublicParishProfileDto>> Published(Guid parishId, CancellationToken ct)
        => Ok(await service.PublicAsync(Guard.Id(parishId), ct));

    [HttpGet("photos/{photoId:guid}")]
    public async Task<IActionResult> Photo(Guid parishId, Guid photoId, CancellationToken ct)
    {
        var (content, type) = await service.PublicPhotoAsync(Guard.Id(parishId), Guard.Id(photoId), ct);
        // A photo id names one immutable upload; 15 minutes, not a day, so an unpublished photo leaves visitors' browsers soon.
        Response.Headers.CacheControl = "public, max-age=900";
        return File(content, type);
    }
}
