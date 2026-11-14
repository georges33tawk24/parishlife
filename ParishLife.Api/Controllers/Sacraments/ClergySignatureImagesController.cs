// Purpose: exposes a priest's own signature image in a parish over HTTP: metadata, private content, multipart upload/replace and removal.
// The image is a picture for printed paper certificates, not an electronic signature; the account area's account/signature route is separate.
// Main functions: Mine, Content, Upload and Remove delegate rules to ClergySignatureImageService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Sacraments;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Sacraments;

namespace ParishLife.Api.Controllers.Sacraments;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}/clergy-signature-image")]
public class ClergySignatureImagesController(ClergySignatureImageService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ClergySignatureImageDto>> Mine(Guid parishId, CancellationToken ct)
        => Ok(await service.MineAsync(Guard.Id(parishId), ct));

    [HttpGet("content")]
    public async Task<IActionResult> Content(Guid parishId, CancellationToken ct)
    {
        var (content, type) = await service.MyContentAsync(Guard.Id(parishId), ct);
        Response.Headers.CacheControl = "private, no-store";
        return File(content, type);
    }

    [HttpPost, RequestSizeLimit(ClergySignatureImageService.MaximumBytes + 64 * 1024)]
    public async Task<ActionResult<ClergySignatureImageDto>> Upload(Guid parishId, [FromForm] Guid operationId, IFormFile file, CancellationToken ct)
    {
        if (file.Length > ClergySignatureImageService.MaximumBytes)
            throw new DomainException("invalid_file", "A signature image must be between 1 byte and 1 MB.");
        using var buffer = new MemoryStream();
        await file.CopyToAsync(buffer, ct);
        return Ok(await service.UploadAsync(Guard.Id(parishId), operationId, file.ContentType, buffer.ToArray(), ct));
    }

    [HttpPost("remove")]
    public async Task<ActionResult<ClergySignatureImageDto>> Remove(Guid parishId, RemoveSignatureImageDto request, CancellationToken ct)
        => Ok(await service.RemoveAsync(Guard.Id(parishId), request, ct));
}
