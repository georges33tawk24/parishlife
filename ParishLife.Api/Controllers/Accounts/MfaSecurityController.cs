// Purpose: exposes owner-only MFA status, authenticator enrollment, code replacement, and reviewed recovery requests.
// Main functions: Status, Begin, Complete, ReplaceCodes, RequestRecovery, RecoveryRequest; secret-changing success signs out superseded sessions.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ParishLife.Api.Authorization;
using ParishLife.Api.DTOs.Accounts;
using ParishLife.Api.Identity;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Controllers.Accounts;

[ApiController]
[Authorize]
[Route("api/auth/mfa")]
[EnableRateLimiting("authentication")]
public class MfaSecurityController(MfaSecurityService security, MfaRecoveryService recovery, SignInManager<ParishUser> signIn) : ControllerBase
{
    [HttpGet("status"), AllowRecoverySession]
    public async Task<ActionResult<MfaSecurityStatusDto>> Status(CancellationToken ct) => Ok(await security.StatusAsync(ct));

    [HttpPost("enrollment"), AllowRecoverySession]
    public async Task<ActionResult<MfaEnrollmentDto>> Begin(BeginMfaEnrollmentDto request, CancellationToken ct) => Ok(await security.BeginAsync(request, ct));

    [HttpPost("enrollment/complete"), AllowRecoverySession]
    public async Task<ActionResult<MfaRecoveryCodesDto>> Complete(CompleteMfaEnrollmentDto request, CancellationToken ct)
    {
        var result = await security.CompleteAsync(request, ct);
        await signIn.SignOutAsync();
        return Ok(result);
    }

    [HttpPost("recovery-codes"), AllowRecoverySession]
    public async Task<ActionResult<MfaRecoveryCodesDto>> ReplaceCodes(RegenerateRecoveryCodesDto request, CancellationToken ct)
    {
        var result = await security.RegenerateAsync(request, ct);
        await signIn.SignOutAsync();
        return Ok(result);
    }

    [HttpPost("recovery-requests"), AllowRecoverySession]
    public async Task<ActionResult<MfaRecoveryRequestDto>> RequestRecovery(RequestMfaRecoveryDto request, CancellationToken ct) => Ok(await recovery.RequestAsync(request, ct));

    [HttpGet("recovery-requests/{requestId:guid}"), AllowRecoverySession]
    public async Task<ActionResult<Versioned<MfaRecoveryRequestDto>>> RecoveryRequest(Guid requestId, CancellationToken ct) => Ok(await recovery.GetOwnAsync(Guard.Id(requestId), ct));
}
