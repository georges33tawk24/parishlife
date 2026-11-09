// Purpose: exposes scoped ministry leadership appointments, explicit handover, ending and authorized history.
// Main functions: Appoint, Get, List, ChangeDuties, End and History delegate consequential authorization and state changes to the service.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Ministries;

namespace ParishLife.Api.Controllers.Ministries;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}/ministries/{ministryId:guid}/leadership")]
public class MinistryLeadershipController(MinistryLeadershipService service) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<MinistryLeaderDto>> Appoint(Guid parishId, Guid ministryId, AppointLeaderDto request, CancellationToken ct)
        => Ok(await service.AppointAsync(Guard.Id(parishId), Guard.Id(ministryId), request, ct));

    [HttpGet]
    public async Task<ActionResult<Page<Versioned<MinistryLeaderDto>>>> List(Guid parishId, Guid ministryId, CancellationToken ct,
        int size = 25, string? cursor = null)
        => Ok(await service.ListAsync(Guard.Id(parishId), Guard.Id(ministryId), size, cursor, ct));

    [HttpGet("{accountId:guid}")]
    public async Task<ActionResult<Versioned<MinistryLeaderDto>>> Get(Guid parishId, Guid ministryId, Guid accountId, CancellationToken ct)
        => Ok(await service.GetAsync(Guard.Id(parishId), Guard.Id(ministryId), Guard.Id(accountId), ct));

    [HttpPost("{accountId:guid}/end")]
    public async Task<ActionResult<MinistryLeaderDto>> End(Guid parishId, Guid ministryId, Guid accountId, EndMinistryLeaderDto request, CancellationToken ct)
        => Ok(await service.EndAsync(Guard.Id(parishId), Guard.Id(ministryId), Guard.Id(accountId), request, ct));

    [HttpPost("{accountId:guid}/duties")]
    public async Task<ActionResult<MinistryLeaderDto>> ChangeDuties(Guid parishId, Guid ministryId, Guid accountId, ChangeMinistryLeaderDutiesDto request, CancellationToken ct)
        => Ok(await service.ChangeDutiesAsync(Guard.Id(parishId), Guard.Id(ministryId), Guard.Id(accountId), request, ct));

    [HttpGet("{accountId:guid}/history")]
    public async Task<ActionResult<Page<MinistryLeadershipHistoryDto>>> History(Guid parishId, Guid ministryId, Guid accountId,
        CancellationToken ct, int size = 25, string? cursor = null)
        => Ok(await service.HistoryAsync(Guard.Id(parishId), Guard.Id(ministryId), Guard.Id(accountId), size, cursor, ct));
}
