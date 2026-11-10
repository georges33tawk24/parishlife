// Purpose: exposes duplicate suggestions, reviewer decisions and reviewed person merges/unmerges over HTTP.
// Main functions: Suggestions, Decide, PreviewMerge, Merge, Unmerge and Merges delegate rules to DuplicateService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.Models;
using ParishLife.Api.Services.People;

namespace ParishLife.Api.Controllers.People;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}/people")]
public class DuplicatesController(DuplicateService service) : ControllerBase
{
    [HttpGet("duplicates")]
    public async Task<ActionResult<IReadOnlyList<DuplicateSuggestionDto>>> Suggestions(Guid parishId, CancellationToken ct)
        => Ok(await service.SuggestAsync(Guard.Id(parishId), ct));

    [HttpPost("duplicates/decisions")]
    public async Task<IActionResult> Decide(Guid parishId, DuplicateDecisionDto request, CancellationToken ct)
    {
        await service.DecideAsync(Guard.Id(parishId), request, ct);
        return NoContent();
    }

    [HttpGet("merges/preview")]
    public async Task<ActionResult<MergePreviewDto>> PreviewMerge(Guid parishId, Guid survivorId, Guid sourceId, CancellationToken ct)
        => Ok(await service.PreviewMergeAsync(Guard.Id(parishId), Guard.Id(survivorId), Guard.Id(sourceId), ct));

    [HttpPost("merges")]
    public async Task<ActionResult<PersonMergeDto>> Merge(Guid parishId, MergePeopleDto request, CancellationToken ct)
        => Ok(await service.MergeAsync(Guard.Id(parishId), request, ct));

    [HttpPost("merges/{mergeId:guid}/unmerge")]
    public async Task<ActionResult<PersonMergeDto>> Unmerge(Guid parishId, Guid mergeId, UnmergePeopleDto request, CancellationToken ct)
        => Ok(await service.UnmergeAsync(Guard.Id(parishId), Guard.Id(mergeId), request, ct));

    [HttpGet("merges")]
    public async Task<ActionResult<IReadOnlyList<PersonMergeDto>>> Merges(Guid parishId, CancellationToken ct)
        => Ok(await service.MergesAsync(Guard.Id(parishId), ct));
}
