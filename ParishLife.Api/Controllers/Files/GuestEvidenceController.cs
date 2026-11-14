// Purpose: lets a guest holding a request's private tracking token (sent in a header, never the URL) add files to that case
// and list the metadata of the files they added. Guests never download through the bearer link.
// Main functions: Upload and List delegate rules to EvidenceService.GuestUploadAsync and GuestListAsync.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ParishLife.Api.DTOs.Files;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Files;

namespace ParishLife.Api.Controllers.Files;

[AllowAnonymous, ApiController, EnableRateLimiting("authentication"), Route("api/public/parishes/{parishId:guid}/requests/{requestId:guid}/files")]
public class GuestEvidenceController(EvidenceService service) : ControllerBase
{
    [HttpPost, RequestSizeLimit(EvidenceService.MaximumBytes + 64 * 1024)]
    public async Task<ActionResult<EvidenceFileDto>> Upload(Guid parishId, Guid requestId, [FromHeader(Name = "X-ParishLife-Tracking")] string? token,
        [FromForm] Guid operationId, IFormFile file, CancellationToken ct, [FromForm] Guid? replacesId = null, [FromForm] string? reason = null,
        [FromForm] string? checklistKey = null)
    {
        if (file.Length > EvidenceService.MaximumBytes)
            throw new DomainException("invalid_file", "Files must be between 1 byte and 10 MB.");
        using var buffer = new MemoryStream();
        await file.CopyToAsync(buffer, ct);
        return Ok(await service.GuestUploadAsync(Guard.Id(parishId), Guard.Id(requestId), token, operationId, file.FileName, file.ContentType, buffer.ToArray(),
            replacesId is { } r ? Guard.Id(r) : null, reason, EvidenceKeys.Checklist(checklistKey), ct));
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<EvidenceFileDto>>> List(Guid parishId, Guid requestId, [FromHeader(Name = "X-ParishLife-Tracking")] string? token,
        CancellationToken ct)
        => Ok(await service.GuestListAsync(Guard.Id(parishId), Guard.Id(requestId), token, ct));
}
