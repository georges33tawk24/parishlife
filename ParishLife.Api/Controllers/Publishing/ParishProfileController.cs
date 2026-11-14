// Purpose: lets a parish's publishing editors read, save, publish and unpublish its public profile and manage its photographs over HTTP.
// Main functions: Get, Save, Act, UploadPhoto (multipart), Photo (private preview) and PhotoAct delegate to ParishProfileService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Publishing;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Publishing;

namespace ParishLife.Api.Controllers.Publishing;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}/profile")]
public class ParishProfileController(ParishProfileService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<Versioned<ParishProfileDto>>> Get(Guid parishId, CancellationToken ct)
        => Ok(await service.GetAsync(Guard.Id(parishId), ct));

    [HttpPut]
    public async Task<ActionResult<Versioned<ParishProfileDto>>> Save(Guid parishId, SaveParishProfileDto request, CancellationToken ct)
        => Ok(await service.SaveAsync(Guard.Id(parishId), request, ct));

    [HttpPost("actions")]
    public async Task<ActionResult<Versioned<ParishProfileDto>>> Act(Guid parishId, ParishProfileActionDto request, CancellationToken ct)
        => Ok(await service.ActAsync(Guard.Id(parishId), request, ct));

    [HttpPost("photos"), RequestSizeLimit(ParishProfileService.MaximumPhotoBytes + 64 * 1024)]
    public async Task<ActionResult<ParishProfilePhotoDto>> UploadPhoto(Guid parishId, [FromForm] Guid operationId, IFormFile file, CancellationToken ct,
        [FromForm] string? caption = null, [FromForm] string? captionAr = null)
    {
        if (file.Length > ParishProfileService.MaximumPhotoBytes)
            throw new DomainException("invalid_file", "Photos must be between 1 byte and 5 MB.");
        if (operationId == Guid.Empty)
            throw new DomainException("invalid_id", "A nonempty UUID is required.");
        using var buffer = new MemoryStream();
        await file.CopyToAsync(buffer, ct);
        return Ok(await service.UploadPhotoAsync(Guard.Id(parishId), operationId, file.ContentType, buffer.ToArray(), caption, captionAr, ct));
    }

    [HttpGet("photos/{photoId:guid}")]
    public async Task<IActionResult> Photo(Guid parishId, Guid photoId, CancellationToken ct)
    {
        var (content, type) = await service.DownloadPhotoAsync(Guard.Id(parishId), Guard.Id(photoId), ct);
        return File(content, type);
    }

    [HttpPost("photos/{photoId:guid}/actions")]
    public async Task<ActionResult<ParishProfilePhotoDto>> PhotoAct(Guid parishId, Guid photoId, ParishProfilePhotoActionDto request, CancellationToken ct)
        => Ok(await service.PhotoActAsync(Guard.Id(parishId), Guard.Id(photoId), request, ct));
}
