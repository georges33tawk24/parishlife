// Purpose: exposes ministry volunteer opportunities, invitations/signups, assignment transitions, team and own sheets, and hours over HTTP.
// Main functions: CreateOpportunity, OpportunityAction, ListOpportunities, OpenOpportunities, Invite, Act, Team, Mine, SubmitHours,
// HoursAction, Hours and MyHours delegate authority and transitions to MinistryVolunteerService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Ministries;

namespace ParishLife.Api.Controllers.Ministries;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}/ministries/{ministryId:guid}/volunteering")]
public class MinistryVolunteersController(MinistryVolunteerService service) : ControllerBase
{
    [HttpPost("opportunities")]
    public async Task<ActionResult<VolunteerOpportunityDto>> CreateOpportunity(Guid parishId, Guid ministryId, SaveOpportunityDto request, CancellationToken ct)
        => Ok(await service.CreateOpportunityAsync(Guard.Id(parishId), Guard.Id(ministryId), request, ct));

    [HttpPost("opportunities/{opportunityId:guid}/actions")]
    public async Task<ActionResult<VolunteerOpportunityDto>> OpportunityAction(Guid parishId, Guid ministryId, Guid opportunityId, OpportunityActionDto request, CancellationToken ct)
        => Ok(await service.OpportunityActionAsync(Guard.Id(parishId), Guard.Id(ministryId), Guard.Id(opportunityId), request, ct));

    [HttpGet("opportunities")]
    public async Task<ActionResult<Page<Versioned<VolunteerOpportunityDto>>>> ListOpportunities(Guid parishId, Guid ministryId, CancellationToken ct,
        int size = 25, string? cursor = null)
        => Ok(await service.ListOpportunitiesAsync(Guard.Id(parishId), Guard.Id(ministryId), size, cursor, ct));

    [HttpGet("opportunities/open")]
    public async Task<ActionResult<Page<Versioned<VolunteerOpportunityDto>>>> OpenOpportunities(Guid parishId, Guid ministryId, CancellationToken ct,
        int size = 25, string? cursor = null)
        => Ok(await service.OpenOpportunitiesAsync(Guard.Id(parishId), Guard.Id(ministryId), size, cursor, ct));

    [HttpPost("opportunities/{opportunityId:guid}/assignments")]
    public async Task<ActionResult<VolunteerAssignmentDto>> Invite(Guid parishId, Guid ministryId, Guid opportunityId, InviteVolunteerDto request, CancellationToken ct)
        => Ok(await service.InviteAsync(Guard.Id(parishId), Guard.Id(ministryId), Guard.Id(opportunityId), request, ct));

    [HttpGet("opportunities/{opportunityId:guid}/assignments")]
    public async Task<ActionResult<Page<Versioned<VolunteerAssignmentDto>>>> Team(Guid parishId, Guid ministryId, Guid opportunityId, CancellationToken ct,
        int size = 25, string? cursor = null)
        => Ok(await service.TeamAsync(Guard.Id(parishId), Guard.Id(ministryId), Guard.Id(opportunityId), size, cursor, ct));

    [HttpGet("assignments/mine")]
    public async Task<ActionResult<Page<Versioned<VolunteerAssignmentDto>>>> Mine(Guid parishId, Guid ministryId, CancellationToken ct, int size = 25, string? cursor = null)
        => Ok(await service.OwnAssignmentsAsync(Guard.Id(parishId), Guard.Id(ministryId), size, cursor, ct));

    [HttpPost("assignments/{assignmentId:guid}/actions")]
    public async Task<ActionResult<VolunteerAssignmentDto>> Act(Guid parishId, Guid ministryId, Guid assignmentId, AssignmentActionDto request, CancellationToken ct)
        => Ok(await service.ActAsync(Guard.Id(parishId), Guard.Id(ministryId), Guard.Id(assignmentId), request, ct));

    [HttpPost("assignments/{assignmentId:guid}/hours")]
    public async Task<ActionResult<VolunteerHoursDto>> SubmitHours(Guid parishId, Guid ministryId, Guid assignmentId, SubmitHoursDto request, CancellationToken ct)
        => Ok(await service.SubmitHoursAsync(Guard.Id(parishId), Guard.Id(ministryId), Guard.Id(assignmentId), request, ct));

    [HttpPost("assignments/{assignmentId:guid}/hours/actions")]
    public async Task<ActionResult<VolunteerHoursDto>> HoursAction(Guid parishId, Guid ministryId, Guid assignmentId, HoursActionDto request, CancellationToken ct)
        => Ok(await service.HoursActionAsync(Guard.Id(parishId), Guard.Id(ministryId), Guard.Id(assignmentId), request, ct));

    [HttpGet("people/{personId:guid}/hours")]
    public async Task<ActionResult<Page<Versioned<VolunteerHoursDto>>>> Hours(Guid parishId, Guid ministryId, Guid personId, CancellationToken ct,
        int size = 25, string? cursor = null)
        => Ok(await service.HoursAsync(Guard.Id(parishId), Guard.Id(ministryId), Guard.Id(personId), size, cursor, ct));

    [HttpGet("hours/mine")]
    public async Task<ActionResult<Page<Versioned<VolunteerHoursDto>>>> MyHours(Guid parishId, Guid ministryId, CancellationToken ct, int size = 25, string? cursor = null)
        => Ok(await service.OwnHoursAsync(Guard.Id(parishId), Guard.Id(ministryId), size, cursor, ct));
}
