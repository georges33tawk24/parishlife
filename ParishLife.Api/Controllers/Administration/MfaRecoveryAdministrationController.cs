// Purpose: exposes exact-account recovery review to eligible MFA-authenticated platform operators.
// Main functions: Get and Review require stored operator authority; review additionally verifies fresh password/TOTP and a different target.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Accounts;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Controllers.Administration;

[ApiController]
[Authorize]
[Route("api/administration/accounts/{accountId:guid}/mfa-recovery-requests")]
public class MfaRecoveryAdministrationController(MfaRecoveryService recovery) : ControllerBase
{
    [HttpGet("{requestId:guid}")]
    public async Task<ActionResult<Versioned<MfaRecoveryRequestDto>>> Get(Guid accountId, Guid requestId, CancellationToken ct)
        => Ok(await recovery.GetForOperatorAsync(Guard.Id(accountId), Guard.Id(requestId), ct));

    [HttpPost("{requestId:guid}/review")]
    public async Task<ActionResult<MfaRecoveryRequestDto>> Review(Guid accountId, Guid requestId, ReviewMfaRecoveryDto request, CancellationToken ct)
        => Ok(await recovery.ReviewAsync(Guard.Id(accountId), Guard.Id(requestId), request, ct));
}
