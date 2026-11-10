// Purpose: exposes households, household membership/contact changes and history, and person-to-person relationships over HTTP.
// Main functions: Create, Update, Member, Get, List, History, AddRelationship, EndRelationship and Relationships delegate rules to HouseholdService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.Models;
using ParishLife.Api.Services.People;

namespace ParishLife.Api.Controllers.People;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}")]
public class HouseholdsController(HouseholdService service) : ControllerBase
{
    [HttpPost("households")]
    public async Task<ActionResult<HouseholdDto>> Create(Guid parishId, SaveHouseholdDto request, CancellationToken ct)
        => Ok(await service.SaveAsync(Guard.Id(parishId), null, request, ct));

    [HttpPut("households/{householdId:guid}")]
    public async Task<ActionResult<HouseholdDto>> Update(Guid parishId, Guid householdId, SaveHouseholdDto request, CancellationToken ct)
        => Ok(await service.SaveAsync(Guard.Id(parishId), Guard.Id(householdId), request, ct));

    [HttpPost("households/{householdId:guid}/members")]
    public async Task<ActionResult<HouseholdDto>> Member(Guid parishId, Guid householdId, HouseholdMemberActionDto request, CancellationToken ct)
        => Ok(await service.MemberAsync(Guard.Id(parishId), Guard.Id(householdId), request, ct));

    [HttpGet("households/{householdId:guid}")]
    public async Task<ActionResult<Versioned<HouseholdDto>>> Get(Guid parishId, Guid householdId, CancellationToken ct)
        => Ok(await service.GetAsync(Guard.Id(parishId), Guard.Id(householdId), ct));

    [HttpGet("households")]
    public async Task<ActionResult<Page<Versioned<HouseholdDto>>>> List(Guid parishId, CancellationToken ct, int size = 25, string? cursor = null)
        => Ok(await service.ListAsync(Guard.Id(parishId), size, cursor, ct));

    [HttpGet("households/{householdId:guid}/history")]
    public async Task<ActionResult<Page<HouseholdChangeDto>>> History(Guid parishId, Guid householdId, CancellationToken ct, int size = 25, string? cursor = null)
        => Ok(await service.HistoryAsync(Guard.Id(parishId), Guard.Id(householdId), size, cursor, ct));

    [HttpPost("people/{personId:guid}/relationships")]
    public async Task<ActionResult<RelationshipDto>> AddRelationship(Guid parishId, Guid personId, AddRelationshipDto request, CancellationToken ct)
        => Ok(await service.AddRelationshipAsync(Guard.Id(parishId), Guard.Id(personId), request, ct));

    [HttpPost("people/{personId:guid}/relationships/{relationshipId}/end")]
    public async Task<ActionResult<RelationshipDto>> EndRelationship(Guid parishId, Guid personId, string relationshipId, EndRelationshipDto request, CancellationToken ct)
        => Ok(await service.EndRelationshipAsync(Guard.Id(parishId), Guard.Id(personId), Guard.Text(relationshipId, "Relationship", 40), request, ct));

    [HttpGet("people/{personId:guid}/relationships")]
    public async Task<ActionResult<Page<Versioned<RelationshipDto>>>> Relationships(Guid parishId, Guid personId, CancellationToken ct, int size = 25, string? cursor = null)
        => Ok(await service.RelationshipsAsync(Guard.Id(parishId), Guard.Id(personId), size, cursor, ct));
}
