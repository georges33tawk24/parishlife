// Purpose: completes the password-bound login challenge with one recovery code and issues only a restricted cookie.
// Main function: Complete returns a safe profile and expiry after code/challenge/session commit together.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ParishLife.Api.DTOs.Accounts;
using ParishLife.Api.Identity;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Controllers.Accounts;

[ApiController]
[Route("api/auth/login/mfa/recovery")]
[EnableRateLimiting("authentication")]
public class RecoveryLoginController(MfaSecurityService security, AccountCookieService cookies) : ControllerBase
{
    [AllowAnonymous, HttpPost]
    public async Task<ActionResult<RecoverySignInDto>> Complete(CompleteRecoveryLoginDto request, CancellationToken ct)
    {
        var result = await security.RecoverLoginAsync(request, ct);
        if (result is null)
            return Unauthorized();
        await cookies.IssueAsync(result.Value.User, result.Value.Session);
        return Ok(new RecoverySignInDto
        {
            Account = AccountDto.From(result.Value.User),
            ExpiresAt = result.Value.Session.ExpiresAt,
            AuthenticationMethod = result.Value.Session.AuthenticationMethod
        });
    }
}
