// Purpose: HTTP endpoints for parishes workflows; delegates work to backend services.
// Main functions: Register, Get, Verify, Grant, Revoke, Propose, Decide, Association, EndAssociation.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Organizations;

namespace ParishLife.Api.Controllers.Organizations;

[Authorize, ApiController, Route("api/parishes")]
public sealed class ParishesController(ParishService service) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Register(RegisterParishDto request, CancellationToken ct) => Ok(ParishDto.From(await service.RegisterAsync(request, ct)));
    [HttpGet("{parishId:guid}")]
    public async Task<IActionResult> Get(Guid parishId, CancellationToken ct)
    {
        var row = await service.GetAsync(Guard.Id(parishId), ct);
        return Ok(new Versioned<ParishDto> { Value = ParishDto.From(row.Value), Version = row.Version });
    }

    [HttpPost("{parishId:guid}/verify")]
    public async Task<IActionResult> Verify(Guid parishId, VerifyParishDto request, CancellationToken ct) => Ok(ParishDto.From(await service.VerifyAsync(Guard.Id(parishId), request, ct)));
    [HttpPut("{parishId:guid}/grants")]
    public async Task<IActionResult> Grant(Guid parishId, GrantAccessDto request, CancellationToken ct)
    {
        await service.GrantAsync(Guard.Id(parishId), request, ct);
        return NoContent();
    }

    [HttpPost("{parishId:guid}/grants/revoke")]
    public async Task<IActionResult> Revoke(Guid parishId, RevokeAccessDto request, CancellationToken ct)
    {
        await service.RevokeAsync(Guard.Id(parishId), request, ct);
        return NoContent();
    }

    [HttpPost("{parishId:guid}/association-requests")]
    public async Task<IActionResult> Propose(Guid parishId, AssociationProposalDto request, CancellationToken ct) => Ok(AssociationDto.From(await service.ProposeAssociationAsync(Guard.Id(parishId), request, ct)));
    [HttpPost("{parishId:guid}/association-requests/{requestId:guid}/decision")]
    public async Task<IActionResult> Decide(Guid parishId, Guid requestId, AssociationDecisionDto request, CancellationToken ct) => Ok(AssociationDto.From(await service.DecideAssociationAsync(Guard.Id(parishId), Guard.Id(requestId), request, ct)));
    [HttpGet("{parishId:guid}/association-requests/{requestId:guid}")]
    public async Task<IActionResult> Association(Guid parishId, Guid requestId, CancellationToken ct)
    {
        var row = await service.GetAssociationAsync(Guard.Id(parishId), Guard.Id(requestId), ct);
        return Ok(new Versioned<AssociationDto> { Value = AssociationDto.From(row.Value), Version = row.Version });
    }
    [HttpPost("{parishId:guid}/association/end")]
    public async Task<IActionResult> EndAssociation(Guid parishId, EndAssociationDto request, CancellationToken ct) => Ok(ParishDto.From(await service.EndAssociationAsync(Guard.Id(parishId), request, ct)));
}
