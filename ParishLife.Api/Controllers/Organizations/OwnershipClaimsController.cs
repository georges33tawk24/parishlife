// Purpose: HTTP routes for contested parish ownership claims and administration recovery (SUB12); authorization lives in the service.
// Main functions: Open, List, Get, Respond, Withdraw and Decide (platform recovery operator).

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Organizations;

namespace ParishLife.Api.Controllers.Organizations;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}/ownership-claims")]
public sealed class OwnershipClaimsController(OwnershipRecoveryService service) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<OwnershipClaimDto>> Open(Guid parishId, OpenOwnershipClaimDto request, CancellationToken ct)
        => Ok(await service.OpenAsync(Guard.Id(parishId), request, ct));

    [HttpGet]
    public async Task<ActionResult<Page<OwnershipClaimDto>>> List(Guid parishId, CancellationToken ct, int size = 25, string? cursor = null)
        => Ok(await service.ListAsync(Guard.Id(parishId), size, cursor, ct));

    [HttpGet("{claimId:guid}")]
    public async Task<ActionResult<Versioned<OwnershipClaimDto>>> Get(Guid parishId, Guid claimId, CancellationToken ct)
        => Ok(await service.GetAsync(Guard.Id(parishId), Guard.Id(claimId), ct));

    [HttpPost("{claimId:guid}/response")]
    public async Task<ActionResult<OwnershipClaimDto>> Respond(Guid parishId, Guid claimId, RespondOwnershipClaimDto request, CancellationToken ct)
        => Ok(await service.RespondAsync(Guard.Id(parishId), Guard.Id(claimId), request, ct));

    [HttpPost("{claimId:guid}/withdraw")]
    public async Task<ActionResult<OwnershipClaimDto>> Withdraw(Guid parishId, Guid claimId, WithdrawOwnershipClaimDto request, CancellationToken ct)
        => Ok(await service.WithdrawAsync(Guard.Id(parishId), Guard.Id(claimId), request, ct));

    [HttpPost("{claimId:guid}/decision")]
    public async Task<ActionResult<OwnershipClaimDto>> Decide(Guid parishId, Guid claimId, DecideOwnershipClaimDto request, CancellationToken ct)
        => Ok(await service.DecideAsync(Guard.Id(parishId), Guard.Id(claimId), request, ct));
}
