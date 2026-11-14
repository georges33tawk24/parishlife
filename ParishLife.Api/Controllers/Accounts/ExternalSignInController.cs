// Purpose: HTTP endpoints for optional, configuration-gated external sign-in and account linking (A06).
// Main functions: List, SignIn, Link, LinkTicket and LinkRedirect (provider challenge redirects; the ticket pair lets a browser start
// linking with a credential-free form post), Complete (link result, cookie or MFA challenge; JSON, or for a portal round trip a redirect
// to the fixed portal page), PendingChallenge (hands a portal round trip's MFA challenge to the portal once) and Unlink.
// Providers that are not configured answer external_provider_unavailable; nothing here reports success it did not get from a provider.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ParishLife.Api.Authorization;
using ParishLife.Api.Configuration;
using ParishLife.Api.DTOs.Accounts;
using ParishLife.Api.Identity;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Controllers.Accounts;

[ApiController]
[Route("api/auth/external")]
[EnableRateLimiting("authentication")]
public class ExternalSignInController(ExternalSignInService external, SignInManager<ParishUser> signIn, AccountCookieService cookies) : ControllerBase
{
    // The only place a portal round trip returns to: a fixed page of this host, with a status word and nothing secret in the address.
    public const string PortalPage = "/index.html?external=";

    [Authorize, HttpGet]
    public async Task<ActionResult<IReadOnlyList<ExternalLoginDto>>> List(CancellationToken ct) => Ok(await external.ListAsync(ct));

    [AllowAnonymous, HttpPost("{provider}/sign-in"), TurnstileProtected]
    public async Task<IActionResult> SignIn(string provider)
    {
        // A browser form post may ask to come back to the portal (returnTo=portal); any other value keeps the JSON answer.
        var portal = Request.HasFormContentType && (await Request.ReadFormAsync(HttpContext.RequestAborted))["returnTo"] == "portal";
        return Challenge(await external.SignInPropertiesAsync(provider, portal), ExternalProviderOptions.SchemePrefix + provider);
    }

    [Authorize, HttpPost("{provider}/link")]
    public async Task<IActionResult> Link(string provider, LinkExternalLoginDto proof, CancellationToken ct)
        => Challenge(await external.LinkPropertiesAsync(provider, proof, ct), ExternalProviderOptions.SchemePrefix + provider);

    [Authorize, HttpPost("{provider}/link/ticket")]
    public async Task<ActionResult<ExternalLinkTicketDto>> LinkTicket(string provider, LinkExternalLoginDto proof, CancellationToken ct)
        => Ok(await external.LinkTicketAsync(provider, proof, ct));

    [Authorize, HttpPost("{provider}/link/redirect"), Consumes("application/x-www-form-urlencoded")]
    public async Task<IActionResult> LinkRedirect(string provider, [FromForm] StartExternalLinkDto request, CancellationToken ct)
        => Challenge(await external.LinkFromTicketAsync(provider, request, ct), ExternalProviderOptions.SchemePrefix + provider);

    [AllowAnonymous, HttpGet("complete")]
    public async Task<IActionResult> Complete([FromQuery(Name = "return")] string? returnTo, CancellationToken ct)
    {
        var portal = returnTo == "portal";
        (string Mode, ParishUser User, AccountSession? Session, MfaLoginChallengeDto? Challenge)? result;
        try
        {
            result = await external.CompleteAsync(ct);
        }
        catch (DomainException error) when (portal)
        {
            return Redirect(PortalPage + (error.Code == "external_login_in_use" ? "in-use" : "failed"));
        }
        if (result is null)
            return portal ? Redirect(PortalPage + "not-linked")
                : Problem(statusCode: 401, title: "external_login_not_linked", detail: "This external sign-in is not linked to an eligible account. Sign in normally and link it from account settings.");
        var (mode, user, session, challenge) = result.Value;
        if (mode == "link")
            return portal ? Redirect(PortalPage + "linked") : Ok(new { status = "Linked" });
        if (challenge is not null)
        {
            if (!portal)
                return Accepted(new { requiresTwoFactor = true, challenge });
            external.HoldPendingChallenge(challenge);
            return Redirect(PortalPage + "two-factor");
        }
        await cookies.IssueAsync(user, session!);
        return portal ? Redirect(PortalPage + "signed-in") : Ok(AccountDto.From(user));
    }

    // Anonymous and one-time: returns the challenge a portal round trip left in its protected cookie, then forgets it.
    [AllowAnonymous, HttpPost("pending-challenge")]
    public ActionResult<MfaLoginChallengeDto> PendingChallenge()
        => external.TakePendingChallenge() is { } challenge ? Ok(challenge)
            : Problem(statusCode: 404, title: "external_challenge_not_found", detail: "No authenticator step is waiting. Sign in again.");

    [Authorize, HttpPost("{provider}/unlink")]
    public async Task<ActionResult<AccountSecurityChangeDto>> Unlink(string provider, UnlinkExternalLoginDto request, CancellationToken ct)
    {
        var result = await external.UnlinkAsync(provider, request, ct);
        await signIn.SignOutAsync();
        return Ok(result);
    }
}
