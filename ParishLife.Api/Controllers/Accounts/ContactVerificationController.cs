// Purpose: HTTP endpoints for email-ownership verification and verified sign-in email replacement (A06).
// Main functions: RequestCode, Confirm (anonymous, neutral), BeginEmailChange, ConfirmEmailChange (signs out after the identifier changes),
// RequestPasswordReset (anonymous, bot-checked, neutral) and ConfirmPasswordReset (anonymous; signs out any cookie in this browser).

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
public class ContactVerificationController(ContactVerificationService contacts, SignInManager<ParishUser> signIn) : ControllerBase
{
    [AllowAnonymous, HttpPost("contact-verification"), TurnstileProtected]
    public async Task<ActionResult<ContactVerificationStatusDto>> RequestCode(RequestContactVerificationDto request, CancellationToken ct)
        => Accepted(await contacts.RequestAsync(request, ct));

    [AllowAnonymous, HttpPost("contact-verification/confirm")]
    public async Task<ActionResult<ContactVerificationStatusDto>> Confirm(ConfirmContactVerificationDto request, CancellationToken ct)
        => Ok(await contacts.ConfirmAsync(request, ct));

    [AllowAnonymous, HttpPost("password-reset"), TurnstileProtected]
    public async Task<ActionResult<ContactVerificationStatusDto>> RequestPasswordReset(RequestPasswordResetDto request, CancellationToken ct)
        => Accepted(await contacts.RequestPasswordResetAsync(request, ct));

    [AllowAnonymous, HttpPost("password-reset/confirm")]
    public async Task<ActionResult<AccountSecurityChangeDto>> ConfirmPasswordReset(ConfirmPasswordResetDto request, CancellationToken ct)
    {
        var result = await contacts.ConfirmPasswordResetAsync(request, ct);
        await signIn.SignOutAsync();
        return Ok(result);
    }

    [Authorize, HttpPost("email-change")]
    public async Task<ActionResult<EmailChangeDto>> BeginEmailChange(BeginEmailChangeDto request, CancellationToken ct)
        => Ok(await contacts.BeginEmailChangeAsync(request, ct));

    [Authorize, HttpPost("email-change/confirm")]
    public async Task<ActionResult<AccountSecurityChangeDto>> ConfirmEmailChange(ConfirmEmailChangeDto request, CancellationToken ct)
    {
        var result = await contacts.ConfirmEmailChangeAsync(request, ct);
        await signIn.SignOutAsync();
        return Ok(result);
    }
}
