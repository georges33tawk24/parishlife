// Purpose: exposes a member's own data view and personal data closure requests, and the office review of them, over HTTP.
// Main functions: OwnData, RequestClosure, OwnRequests, Queue, Preview and Decide delegate rules to PersonDataService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.Models;
using ParishLife.Api.Services.People;

namespace ParishLife.Api.Controllers.People;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}")]
public class PersonDataController(PersonDataService service) : ControllerBase
{
    [HttpGet("me/data")]
    public async Task<ActionResult<OwnDataDto>> OwnData(Guid parishId, CancellationToken ct)
        => Ok(await service.OwnDataAsync(Guard.Id(parishId), ct));

    [HttpPost("me/data-closure-requests")]
    public async Task<ActionResult<DataClosureRequestDto>> RequestClosure(Guid parishId, DataClosureRequestDto request, CancellationToken ct)
        => Ok(await service.RequestAsync(Guard.Id(parishId), request, ct));

    [HttpGet("me/data-closure-requests")]
    public async Task<ActionResult<IReadOnlyList<DataClosureRequestDto>>> OwnRequests(Guid parishId, CancellationToken ct)
        => Ok(await service.OwnRequestsAsync(Guard.Id(parishId), ct));

    [HttpGet("data-closure-requests")]
    public async Task<ActionResult<IReadOnlyList<DataClosureRequestDto>>> Queue(Guid parishId, CancellationToken ct)
        => Ok(await service.QueueAsync(Guard.Id(parishId), ct));

    [HttpGet("data-closure-requests/{requestId:guid}/preview")]
    public async Task<ActionResult<DataClosurePreviewDto>> Preview(Guid parishId, Guid requestId, CancellationToken ct)
        => Ok(await service.PreviewAsync(Guard.Id(parishId), Guard.Id(requestId), ct));

    [HttpPost("data-closure-requests/{requestId:guid}/decision")]
    public async Task<ActionResult<DataClosureRequestDto>> Decide(Guid parishId, Guid requestId, DataClosureDecisionDto request, CancellationToken ct)
        => Ok(await service.DecideAsync(Guard.Id(parishId), Guard.Id(requestId), request, ct));
}
