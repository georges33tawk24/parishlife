// Purpose: exposes parish website drafts, review/publication and the public read of published sections over HTTP.
// Main functions: SaveDraft, Act and Sections delegate to WebsiteService; PublicWebsiteController.Published serves visitors.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Publishing;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Publishing;

namespace ParishLife.Api.Controllers.Publishing;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}/website/sections")]
public class WebsiteController(WebsiteService service) : ControllerBase
{
    [HttpPut("{key}/draft")]
    public async Task<ActionResult<WebsiteSectionDto>> SaveDraft(Guid parishId, string key, SaveWebsiteDraftDto request, CancellationToken ct)
        => Ok(await service.SaveDraftAsync(Guard.Id(parishId), key, request, ct));

    [HttpPost("{key}/revisions/{revisionId:guid}/actions")]
    public async Task<ActionResult<WebsiteSectionDto>> Act(Guid parishId, string key, Guid revisionId, WebsiteActionDto request, CancellationToken ct)
        => Ok(await service.ActAsync(Guard.Id(parishId), key, Guard.Id(revisionId), request, ct));

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<Versioned<WebsiteSectionDto>>>> Sections(Guid parishId, CancellationToken ct)
        => Ok(await service.SectionsAsync(Guard.Id(parishId), ct));
}

[AllowAnonymous, ApiController, Route("api/public/parishes/{parishId:guid}/website")]
public class PublicWebsiteController(WebsiteService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PublicWebsiteSectionDto>>> Published(Guid parishId, CancellationToken ct, string? lang = null)
        => Ok(await service.PublicAsync(Guard.Id(parishId), lang, ct));
}
