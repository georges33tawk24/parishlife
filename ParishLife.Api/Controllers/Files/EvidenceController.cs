// Purpose: exposes private evidence files on request cases over HTTP: multipart upload/replace, list, download and audited removal.
// Main functions: Upload, List, Download and Remove delegate rules to EvidenceService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Files;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Files;

namespace ParishLife.Api.Controllers.Files;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}/requests/{requestId:guid}/files")]
public class EvidenceController(EvidenceService service) : ControllerBase
{
    [HttpPost, RequestSizeLimit(EvidenceService.MaximumBytes + 64 * 1024)]
    public async Task<ActionResult<EvidenceFileDto>> Upload(Guid parishId, Guid requestId, [FromForm] Guid operationId, IFormFile file, CancellationToken ct,
        [FromForm] Guid? replacesId = null, [FromForm] string? reason = null)
    {
        if (file.Length > EvidenceService.MaximumBytes)
            throw new DomainException("invalid_file", "Files must be between 1 byte and 10 MB.");
        using var buffer = new MemoryStream();
        await file.CopyToAsync(buffer, ct);
        return Ok(await service.UploadAsync(Guard.Id(parishId), Guard.Id(requestId), operationId, file.FileName, file.ContentType, buffer.ToArray(),
            replacesId is { } r ? Guard.Id(r) : null, reason, ct));
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<EvidenceFileDto>>> List(Guid parishId, Guid requestId, CancellationToken ct)
        => Ok(await service.ListAsync(Guard.Id(parishId), Guard.Id(requestId), ct));

    [HttpGet("{fileId:guid}")]
    public async Task<IActionResult> Download(Guid parishId, Guid requestId, Guid fileId, CancellationToken ct)
    {
        var (content, type, name) = await service.DownloadAsync(Guard.Id(parishId), Guard.Id(requestId), Guard.Id(fileId), ct);
        return File(content, type, name);
    }

    [HttpPost("{fileId:guid}/remove")]
    public async Task<ActionResult<EvidenceFileDto>> Remove(Guid parishId, Guid requestId, Guid fileId, RemoveEvidenceDto request, CancellationToken ct)
        => Ok(await service.RemoveAsync(Guard.Id(parishId), Guard.Id(requestId), Guard.Id(fileId), request, ct));
}
