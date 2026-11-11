// Purpose: HTTP endpoints for owner passkey management and passkey sign-in; delegates ceremonies and commits to PasskeyService.
// Main functions: List, BeginRegistration, CompleteRegistration, Remove (signs out), BeginLogin, CompleteLogin (cookie or MFA challenge).

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ParishLife.Api.Authorization;
using ParishLife.Api.DTOs.Accounts;
using ParishLife.Api.Identity;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Controllers.Accounts;

[ApiController]
[Route("api/auth")]
[EnableRateLimiting("authentication")]
public class PasskeysController(PasskeyService passkeys, SignInManager<ParishUser> signIn, AccountCookieService cookies) : ControllerBase
{
    [Authorize, HttpGet("passkeys")]
    public async Task<ActionResult<IReadOnlyList<PasskeyDto>>> List(CancellationToken ct) => Ok(await passkeys.ListAsync(ct));

    [Authorize, HttpPost("passkeys/registration/options")]
    public async Task<ActionResult<PasskeyCeremonyDto>> BeginRegistration(BeginPasskeyRegistrationDto request, CancellationToken ct)
        => Ok(await passkeys.BeginRegistrationAsync(request, ct));

    [Authorize, HttpPost("passkeys/registration")]
    public async Task<ActionResult<PasskeyDto>> CompleteRegistration(CompletePasskeyRegistrationDto request, CancellationToken ct)
        => Ok(await passkeys.CompleteRegistrationAsync(request, ct));

    [Authorize, HttpPost("passkeys/{credentialId}/remove")]
    public async Task<ActionResult<AccountSecurityChangeDto>> Remove(string credentialId, RemovePasskeyDto request, CancellationToken ct)
    {
        var result = await passkeys.RemoveAsync(credentialId, request, ct);
        await signIn.SignOutAsync();
        return Ok(result);
    }

    [AllowAnonymous, HttpPost("login/passkey/options"), TurnstileProtected]
    public async Task<ActionResult<PasskeyCeremonyDto>> BeginLogin() => Ok(await passkeys.BeginLoginAsync());

    [AllowAnonymous, HttpPost("login/passkey")]
    public async Task<IActionResult> CompleteLogin(CompletePasskeyLoginDto request, CancellationToken ct)
    {
        var result = await passkeys.CompleteLoginAsync(request, ct);
        if (result is null)
            return Unauthorized();
        if (result.Value.Challenge is not null)
            return Accepted(new { requiresTwoFactor = true, challenge = result.Value.Challenge });
        await cookies.IssueAsync(result.Value.User, result.Value.Session!);
        return Ok(AccountDto.From(result.Value.User));
    }
}
