// Purpose: exposes typed ministry application, review, evidence, history and neutral membership endpoints.
// Main functions: Apply, Get, List, Mine, Act, History, Evidence, Roster and Membership delegate consequential rules to the service.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Ministries;

namespace ParishLife.Api.Controllers.Ministries;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}/ministries/{ministryId:guid}")]
public class MinistryApplicationsController(MinistryApplicationService service) : ControllerBase
{
    [HttpPost("applications")]
    public async Task<ActionResult<MinistryApplicationDto>> Apply(Guid parishId, Guid ministryId, ApplyMinistryDto request, CancellationToken ct)
        => Ok(await service.ApplyAsync(Guard.Id(parishId), Guard.Id(ministryId), request, ct));
    [HttpGet("applications/{applicationId:guid}")]
    public async Task<ActionResult<Versioned<MinistryApplicationDto>>> Get(Guid parishId, Guid ministryId, Guid applicationId, CancellationToken ct)
        => Ok(await service.GetAsync(Guard.Id(parishId), Guard.Id(ministryId), Guard.Id(applicationId), ct));
    [HttpGet("applications")]
    public async Task<ActionResult<Page<Versioned<MinistryApplicationDto>>>> List(Guid parishId, Guid ministryId, CancellationToken ct,
        string kind = "Join", int size = 25, string? cursor = null)
        => Ok(await service.ListAsync(Guard.Id(parishId), Guard.Id(ministryId), kind, size, cursor, ct));
    [HttpGet("applications/mine")]
    public async Task<ActionResult<Page<Versioned<MinistryApplicationDto>>>> Mine(Guid parishId, Guid ministryId, CancellationToken ct, int size = 25, string? cursor = null)
        => Ok(await service.OwnAsync(Guard.Id(parishId), Guard.Id(ministryId), size, cursor, ct));
    [HttpPost("applications/{applicationId:guid}/actions")]
    public async Task<ActionResult<MinistryApplicationDto>> Act(Guid parishId, Guid ministryId, Guid applicationId, ApplicationActionDto request, CancellationToken ct)
        => Ok(await service.ActAsync(Guard.Id(parishId), Guard.Id(ministryId), Guard.Id(applicationId), request, ct));
    [HttpGet("applications/{applicationId:guid}/history")]
    public async Task<ActionResult<Page<MinistryApplicationHistoryDto>>> History(Guid parishId, Guid ministryId, Guid applicationId, CancellationToken ct, int size = 25, string? cursor = null)
        => Ok(await service.HistoryAsync(Guard.Id(parishId), Guard.Id(ministryId), Guard.Id(applicationId), size, cursor, ct));
    [HttpGet("applications/{applicationId:guid}/evidence")]
    public async Task<ActionResult<MinistryApplicationEvidenceDto>> Evidence(Guid parishId, Guid ministryId, Guid applicationId, CancellationToken ct)
        => Ok(await service.EvidenceAsync(Guard.Id(parishId), Guard.Id(ministryId), Guard.Id(applicationId), ct));
    [HttpGet("roster")]
    public async Task<ActionResult<Page<MinistryMembershipDto>>> Roster(Guid parishId, Guid ministryId, CancellationToken ct, int size = 25, string? cursor = null)
        => Ok(await service.RosterAsync(Guard.Id(parishId), Guard.Id(ministryId), size, cursor, ct));
    [HttpGet("membership/mine")]
    public async Task<ActionResult<MinistryMembershipDto>> Membership(Guid parishId, Guid ministryId, CancellationToken ct)
        => Ok(await service.OwnMembershipAsync(Guard.Id(parishId), Guard.Id(ministryId), ct));
}
