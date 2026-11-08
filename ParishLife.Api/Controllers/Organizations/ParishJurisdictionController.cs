// Purpose: exposes private representative proposals and bishop decisions for factual parish jurisdiction.
// Main functions: Propose, Get, Decide delegate authority, evidence and concurrency checks to ParishJurisdictionService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Organizations;

namespace ParishLife.Api.Controllers.Organizations;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}/jurisdiction-proposals")]
public class ParishJurisdictionController(ParishJurisdictionService service) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<ParishJurisdictionProposalDto>> Propose(Guid parishId, ProposeParishJurisdictionDto request, CancellationToken ct)
        => Ok(await service.ProposeAsync(Guard.Id(parishId), request, ct));

    [HttpGet("{proposalId:guid}")]
    public async Task<ActionResult<Versioned<ParishJurisdictionProposalDto>>> Get(Guid parishId, Guid proposalId, CancellationToken ct)
        => Ok(await service.GetAsync(Guard.Id(parishId), Guard.Id(proposalId), ct));

    [HttpPost("{proposalId:guid}/decision")]
    public async Task<ActionResult<ParishJurisdictionProposalDto>> Decide(Guid parishId, Guid proposalId, DecideParishJurisdictionDto request, CancellationToken ct)
        => Ok(await service.DecideAsync(Guard.Id(parishId), Guard.Id(proposalId), request, ct));
}
