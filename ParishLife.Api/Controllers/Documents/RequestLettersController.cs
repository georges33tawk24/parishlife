// Purpose: exposes office letters for request cases to parish staff and the applicant account, and the guest tracking list.
// Main functions: Create, Revise, Preview, Sign, Release, Withdraw, List, NotificationOutcome and Mine delegate to RequestLetterService;
// GuestRequestLettersController.Guest lists released letters for a tracking token sent in a header.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ParishLife.Api.DTOs.Documents;
using ParishLife.Api.DTOs.Communications;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Documents;

namespace ParishLife.Api.Controllers.Documents;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}")]
public class RequestLettersController(RequestLetterService service) : ControllerBase
{
    [HttpPost("requests/{requestId:guid}/letters")]
    public async Task<ActionResult<LetterDto>> Create(Guid parishId, Guid requestId, CreateLetterDto request, CancellationToken ct)
        => Ok(await service.CreateAsync(Guard.Id(parishId), Guard.Id(requestId), request, ct));

    [HttpGet("requests/{requestId:guid}/letters")]
    public async Task<ActionResult<IReadOnlyList<Versioned<LetterDto>>>> List(Guid parishId, Guid requestId, CancellationToken ct)
        => Ok(await service.ListAsync(Guard.Id(parishId), Guard.Id(requestId), ct));

    [HttpGet("letters/{letterId:guid}/notification-outcome")]
    public async Task<ActionResult<NotificationOutcomeDto>> NotificationOutcome(Guid parishId, Guid letterId, CancellationToken ct)
        => Ok(await service.NotificationOutcomeAsync(Guard.Id(parishId), Guard.Id(letterId), ct));

    [HttpGet("requests/{requestId:guid}/letters/mine")]
    public async Task<ActionResult<IReadOnlyList<ApplicantLetterDto>>> Mine(Guid parishId, Guid requestId, CancellationToken ct)
        => Ok(await service.MineAsync(Guard.Id(parishId), Guard.Id(requestId), ct));

    [HttpPut("letters/{letterId:guid}")]
    public async Task<ActionResult<LetterDto>> Revise(Guid parishId, Guid letterId, ReviseLetterDto request, CancellationToken ct)
        => Ok(await service.ReviseAsync(Guard.Id(parishId), Guard.Id(letterId), request, ct));

    [HttpGet("letters/{letterId:guid}/authorization-preview")]
    public async Task<ActionResult<AuthorizationPreviewDto>> Preview(Guid parishId, Guid letterId, CancellationToken ct)
        => Ok(await service.PreviewAsync(Guard.Id(parishId), Guard.Id(letterId), ct));

    [HttpPost("letters/{letterId:guid}/authorization")]
    public async Task<ActionResult<LetterDto>> Sign(Guid parishId, Guid letterId, AuthorizeDocumentDto request, CancellationToken ct)
        => Ok(await service.SignAsync(Guard.Id(parishId), Guard.Id(letterId), request, ct));

    [HttpPost("letters/{letterId:guid}/release")]
    public async Task<ActionResult<LetterDto>> Release(Guid parishId, Guid letterId, ReleaseLetterDto request, CancellationToken ct)
        => Ok(await service.ReleaseAsync(Guard.Id(parishId), Guard.Id(letterId), request, ct));

    [HttpPost("letters/{letterId:guid}/withdraw")]
    public async Task<ActionResult<LetterDto>> Withdraw(Guid parishId, Guid letterId, WithdrawLetterDto request, CancellationToken ct)
        => Ok(await service.WithdrawAsync(Guard.Id(parishId), Guard.Id(letterId), request, ct));
}

// The tracking token travels in a header, never in the URL.
[AllowAnonymous, ApiController, EnableRateLimiting("authentication"), Route("api/public/parishes/{parishId:guid}/requests/{requestId:guid}/letters")]
public class GuestRequestLettersController(RequestLetterService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ApplicantLetterDto>>> Guest(Guid parishId, Guid requestId, [FromHeader(Name = "X-ParishLife-Tracking")] string? token, CancellationToken ct)
        => Ok(await service.GuestAsync(Guard.Id(parishId), Guard.Id(requestId), token, ct));
}
