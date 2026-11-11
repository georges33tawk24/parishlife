// Purpose: HTTP endpoints for optional, configuration-gated external sign-in and account linking (A06).
// Main functions: List, SignIn and Link (provider challenge redirects), Complete (link result, cookie or MFA challenge), Unlink.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ParishLife.Api.Authorization;
using ParishLife.Api.Configuration;
using ParishLife.Api.DTOs.Accounts;
using ParishLife.Api.Identity;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Controllers.Accounts;

[ApiController]
[Route("api/auth/external")]
[EnableRateLimiting("authentication")]
public class ExternalSignInController(ExternalSignInService external, SignInManager<ParishUser> signIn, AccountCookieService cookies) : ControllerBase
{
    [Authorize, HttpGet]
    public async Task<ActionResult<IReadOnlyList<ExternalLoginDto>>> List(CancellationToken ct) => Ok(await external.ListAsync(ct));

    [AllowAnonymous, HttpPost("{provider}/sign-in"), TurnstileProtected]
    public async Task<IActionResult> SignIn(string provider)
        => Challenge(await external.SignInPropertiesAsync(provider), ExternalProviderOptions.SchemePrefix + provider);

    [Authorize, HttpPost("{provider}/link")]
    public async Task<IActionResult> Link(string provider, LinkExternalLoginDto proof, CancellationToken ct)
        => Challenge(await external.LinkPropertiesAsync(provider, proof, ct), ExternalProviderOptions.SchemePrefix + provider);

    [AllowAnonymous, HttpGet("complete")]
    public async Task<IActionResult> Complete(CancellationToken ct)
    {
        var result = await external.CompleteAsync(ct);
        if (result is null)
            return Problem(statusCode: 401, title: "external_login_not_linked", detail: "This external sign-in is not linked to an eligible account. Sign in normally and link it from account settings.");
        var (mode, user, session, challenge) = result.Value;
        if (mode == "link")
            return Ok(new { status = "Linked" });
        if (challenge is not null)
            return Accepted(new { requiresTwoFactor = true, challenge });
        await cookies.IssueAsync(user, session!);
        return Ok(AccountDto.From(user));
    }

    [Authorize, HttpPost("{provider}/unlink")]
    public async Task<ActionResult<AccountSecurityChangeDto>> Unlink(string provider, UnlinkExternalLoginDto request, CancellationToken ct)
    {
        var result = await external.UnlinkAsync(provider, request, ct);
        await signIn.SignOutAsync();
        return Ok(result);
    }
}
