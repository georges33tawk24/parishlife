// Purpose: exposes request cases for applicants and the parish office, plus anonymous guest intake/tracking with a private token header.
// Main functions: Submit, Mine, Queue, Get, Act, SetChecklist, Messages, PostMessage, History, Handover, Claim, Associate, RotateTracking, GuestSubmit,
// GuestGet, GuestAct, GuestMessages and GuestPostMessage delegate rules to RequestService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ParishLife.Api.DTOs.Requests;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Requests;

namespace ParishLife.Api.Controllers.Requests;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}/requests")]
public class RequestsController(RequestService service) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<ParishRequestDto>> Submit(Guid parishId, SubmitRequestDto request, CancellationToken ct)
        => Ok(await service.SubmitAsync(Guard.Id(parishId), request, ct));

    [HttpGet("mine")]
    public async Task<ActionResult<Page<Versioned<ParishRequestDto>>>> Mine(Guid parishId, CancellationToken ct, int size = 25, string? cursor = null)
        => Ok(await service.OwnAsync(Guard.Id(parishId), size, cursor, ct));

    [HttpGet]
    public async Task<ActionResult<Page<Versioned<ParishRequestDto>>>> Queue(Guid parishId, CancellationToken ct, string? status = null, string? kind = null,
        int size = 25, string? cursor = null)
        => Ok(await service.QueueAsync(Guard.Id(parishId), status, kind, size, cursor, ct));

    [HttpGet("{requestId:guid}")]
    public async Task<ActionResult<Versioned<ParishRequestDto>>> Get(Guid parishId, Guid requestId, CancellationToken ct)
        => Ok(await service.GetAsync(Guard.Id(parishId), Guard.Id(requestId), ct));

    [HttpPost("{requestId:guid}/actions")]
    public async Task<ActionResult<ParishRequestDto>> Act(Guid parishId, Guid requestId, RequestActionDto request, CancellationToken ct)
        => Ok(await service.ActAsync(Guard.Id(parishId), Guard.Id(requestId), request, ct));

    [HttpPut("{requestId:guid}/checklist")]
    public async Task<ActionResult<ParishRequestDto>> SetChecklist(Guid parishId, Guid requestId, SetChecklistDto request, CancellationToken ct)
        => Ok(await service.SetChecklistAsync(Guard.Id(parishId), Guard.Id(requestId), request, ct));

    [HttpGet("{requestId:guid}/messages")]
    public async Task<ActionResult<IReadOnlyList<RequestMessageDto>>> Messages(Guid parishId, Guid requestId, CancellationToken ct)
        => Ok(await service.MessagesAsync(Guard.Id(parishId), Guard.Id(requestId), null, ct));

    [HttpPost("{requestId:guid}/messages")]
    public async Task<ActionResult<RequestMessageDto>> PostMessage(Guid parishId, Guid requestId, PostRequestMessageDto request, CancellationToken ct)
        => Ok(await service.PostMessageAsync(Guard.Id(parishId), Guard.Id(requestId), request, ct));

    [HttpGet("{requestId:guid}/history")]
    public async Task<ActionResult<IReadOnlyList<RequestHistoryDto>>> History(Guid parishId, Guid requestId, CancellationToken ct)
        => Ok(await service.HistoryAsync(Guard.Id(parishId), Guard.Id(requestId), ct));

    [HttpPost("handover")]
    public async Task<ActionResult<OfficeHandoverResultDto>> Handover(Guid parishId, OfficeHandoverDto request, CancellationToken ct)
        => Ok(await service.HandoverAsync(Guard.Id(parishId), request, ct));

    [HttpPost("{requestId:guid}/claim")]
    public async Task<ActionResult<ParishRequestDto>> Claim(Guid parishId, Guid requestId, [FromHeader(Name = GuestRequestsController.TokenHeader)] string? token, CancellationToken ct)
        => Ok(await service.ClaimGuestAsync(Guard.Id(parishId), Guard.Id(requestId), token, ct));

    [HttpPost("{requestId:guid}/association")]
    public async Task<ActionResult<ParishRequestDto>> Associate(Guid parishId, Guid requestId, RequestAssociationDto request, CancellationToken ct)
        => Ok(await service.DecideAssociationAsync(Guard.Id(parishId), Guard.Id(requestId), request, ct));

    [HttpPost("{requestId:guid}/rotate-tracking")]
    public async Task<ActionResult<GuestRequestReceiptDto>> RotateTracking(Guid parishId, Guid requestId, RotateTrackingDto request, CancellationToken ct)
        => Ok(await service.RotateTrackingAsync(Guard.Id(parishId), Guard.Id(requestId), request, ct));
}

// The tracking token travels in a header, never in the URL, so it does not land in logs or browser history.
[AllowAnonymous, ApiController, EnableRateLimiting("authentication"), Route("api/public/parishes/{parishId:guid}/requests")]
public class GuestRequestsController(RequestService service) : ControllerBase
{
    internal const string TokenHeader = "X-ParishLife-Tracking";

    [HttpPost]
    public async Task<ActionResult<GuestRequestReceiptDto>> GuestSubmit(Guid parishId, GuestRequestDto request, CancellationToken ct)
        => Ok(await service.GuestSubmitAsync(Guard.Id(parishId), request, ct));

    [HttpGet("{requestId:guid}")]
    public async Task<ActionResult<ParishRequestDto>> GuestGet(Guid parishId, Guid requestId, [FromHeader(Name = TokenHeader)] string? token, CancellationToken ct)
        => Ok(await service.GuestGetAsync(Guard.Id(parishId), Guard.Id(requestId), token, ct));

    [HttpPost("{requestId:guid}/actions")]
    public async Task<ActionResult<ParishRequestDto>> GuestAct(Guid parishId, Guid requestId, [FromHeader(Name = TokenHeader)] string? token,
        RequestActionDto request, CancellationToken ct)
        => Ok(await service.GuestActAsync(Guard.Id(parishId), Guard.Id(requestId), token, request, ct));

    [HttpGet("{requestId:guid}/messages")]
    public async Task<ActionResult<IReadOnlyList<RequestMessageDto>>> GuestMessages(Guid parishId, Guid requestId, [FromHeader(Name = TokenHeader)] string? token, CancellationToken ct)
        => Ok(await service.MessagesAsync(Guard.Id(parishId), Guard.Id(requestId), token ?? "", ct));

    [HttpPost("{requestId:guid}/messages")]
    public async Task<ActionResult<RequestMessageDto>> GuestPostMessage(Guid parishId, Guid requestId, [FromHeader(Name = TokenHeader)] string? token,
        PostRequestMessageDto request, CancellationToken ct)
        => Ok(await service.GuestMessageAsync(Guard.Id(parishId), Guard.Id(requestId), token, request, ct));
}
