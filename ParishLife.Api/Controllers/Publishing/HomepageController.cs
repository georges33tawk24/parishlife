// Purpose: exposes the platform homepage editor for platform operators and the public read of the live homepage over HTTP.
// Main functions: Draft, SaveDraft, Publish and History delegate to HomepageService; PublicHomepageController.Published serves visitors.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Publishing;
using ParishLife.Api.Middleware;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Publishing;

namespace ParishLife.Api.Controllers.Publishing;

[Authorize, ApiController, Route("api/administration/homepage")]
public class HomepageController(HomepageService service) : ControllerBase
{
    [HttpGet("draft")]
    public async Task<ActionResult<Versioned<HomepageDraftDto>>> Draft(CancellationToken ct)
        => Ok(await service.GetDraftAsync(ct));

    [HttpPut("draft")]
    public async Task<ActionResult<Versioned<HomepageDraftDto>>> SaveDraft(SaveHomepageDraftDto request, CancellationToken ct)
        => Ok(await service.SaveDraftAsync(request, ct));

    [HttpPost("publish")]
    public async Task<ActionResult<HomepageRevisionDto>> Publish(PublishHomepageDto request, CancellationToken ct)
        => Ok(await service.PublishAsync(request, ct));

    [HttpGet("revisions")]
    public async Task<ActionResult<Page<HomepageRevisionDto>>> History(CancellationToken ct, int size = 25, string? cursor = null)
        => Ok(await service.HistoryAsync(size, cursor, ct));
}

[AllowAnonymous, ApiController, Route("api/public/homepage")]
public class PublicHomepageController(HomepageService service) : ControllerBase
{
    [HttpGet, PublicCache]
    public async Task<ActionResult<PublicHomepageDto>> Published(CancellationToken ct, string? lang = null)
        => Ok(await service.PublicAsync(lang, ct));
}
