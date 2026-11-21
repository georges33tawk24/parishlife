// Purpose: HTTP endpoints for accounts workflows; delegates work to backend services.
// Main functions: Csrf, Register, Login, CompleteMfa (each authenticator code signs in once), Me, Logout, Sessions, Revoke, ChangePassword,
// AddPassword.
// AccountDto.From supplies the shared safe profile projection.
// Rate limits: every sign-in, registration, session and password action uses the strict "authentication" policy. Csrf and Me do not:
// the portal calls them on every page load, so on a shared connection (a parish office or hall) they would use up the sign-in budget
// (owner decision, 18 November 2026). They still count toward the general per-address limit.

using System.Security.Claims;
using Microsoft.AspNetCore.Antiforgery;
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
[Route("api/auth")]
public sealed class AccountsController(AccountService accounts, UserManager<ParishUser> users, SignInManager<ParishUser> signIn,
    AccountSessionService sessions, AccountCookieService cookies, TimeProvider clock, IUserStore<ParishUser> store) : ControllerBase
{
    private const string Authentication = "authentication";

    [AllowAnonymous, HttpGet("csrf")]
    public IActionResult Csrf([FromServices] IAntiforgery antiforgery)
    {
        Response.Headers.CacheControl = "no-store";
        return Ok(new { token = antiforgery.GetAndStoreTokens(HttpContext).RequestToken, header = "X-CSRF-TOKEN" });
    }

    [AllowAnonymous, HttpPost("register"), TurnstileProtected, EnableRateLimiting(Authentication)]
    public async Task<IActionResult> Register(RegisterAccountDto request, CancellationToken ct)
    {
        await accounts.RegisterAsync(request, ct);
        return Accepted(new { status = "RegistrationReceived", message = "If eligible, the account can proceed after the required identity or contact verification. Existing accounts retain their credentials." });
    }

    [AllowAnonymous, HttpPost("login"), TurnstileProtected, EnableRateLimiting(Authentication)]
    public async Task<IActionResult> Login(LoginDto request, CancellationToken ct)
    {
        var identifier = Guard.Text(request.Username ?? request.Email, "Login identifier", 254);
        if (request.Password is null || request.Password.Length > 200)
            return Unauthorized();
        var user = identifier.Contains('@') ? await users.FindByEmailAsync(identifier) : await users.FindByNameAsync(identifier);
        if (user is null || !user.Active)
        {
            SecurityEvents.Log(HttpContext, "security.sign_in_failed", detail: "unknown_or_inactive");
            return Unauthorized();
        }
        var result = await signIn.CheckPasswordSignInAsync(user, request.Password, lockoutOnFailure: true);
        if (!result.Succeeded)
        {
            SecurityEvents.Log(HttpContext, "security.sign_in_failed", user.Id, result.IsLockedOut ? "locked_out" : "password");
            return Unauthorized();
        }
        if (user.PlatformOperator && !user.TwoFactorEnabled)
            return Unauthorized();
        if (user.TwoFactorEnabled)
            return Accepted(new { requiresTwoFactor = true, challenge = await sessions.CreateChallengeAsync(user, ct) });
        var session = await sessions.CreateAsync(user, ct);
        await cookies.IssueAsync(user, session);
        return Ok(AccountDto.From(user));
    }

    [AllowAnonymous, HttpPost("login/mfa"), EnableRateLimiting(Authentication)]
    public async Task<IActionResult> CompleteMfa(CompleteMfaDto request, CancellationToken ct)
    {
        var user = await users.FindByIdAsync(Guard.Id(request.AccountId));
        var challenge = await sessions.GetChallengeAsync(Guard.Id(request.AccountId), request.Challenge, ct);
        if (user is not { Active: true, TwoFactorEnabled: true } || !AccountVerification.IsVerified(user) || challenge is null || challenge.Value.SecurityStamp != user.SecurityStamp || challenge.Value.Consumed || challenge.Value.ExpiresAt <= clock.GetUtcNow() || await users.IsLockedOutAsync(user))
            return Unauthorized();
        var code = request.Code?.Replace(" ", "", StringComparison.Ordinal);
        // A code that already signed in (vector 6, replay) counts as a failure like a wrong one.
        if (string.IsNullOrWhiteSpace(code) || code.Length > 12 || !await users.VerifyTwoFactorTokenAsync(user, TokenOptions.DefaultAuthenticatorProvider, code)
            || !await ((CosmosIdentityStore)store).ClaimAuthenticatorCodeAsync(user.Id, code, ct))
        {
            _ = await users.AccessFailedAsync(user);
            SecurityEvents.Log(HttpContext, "security.mfa_failed", user.Id);
            return Unauthorized();
        }

        if (!(await users.ResetAccessFailedCountAsync(user)).Succeeded)
            return Unauthorized();
        var session = await sessions.CreateAsync(user, ct, challenge);
        await cookies.IssueAsync(user, session);
        return Ok(AccountDto.From(user));
    }

    [Authorize, HttpGet("me"), AllowRecoverySession]
    public async Task<ActionResult<AccountDto>> Me()
    {
        var user = await users.GetUserAsync(User);
        return user is null ? Unauthorized() : Ok(AccountDto.From(user));
    }

    [Authorize, HttpPost("logout"), AllowRecoverySession, EnableRateLimiting(Authentication)]
    public async Task<IActionResult> Logout(CancellationToken ct)
    {
        await sessions.RevokeAsync(User.FindFirstValue(ClaimTypes.NameIdentifier)!, User.FindFirstValue("sid")!, ct);
        await signIn.SignOutAsync();
        return NoContent();
    }

    [Authorize, HttpGet("sessions"), AllowRecoverySession, EnableRateLimiting(Authentication)]
    public async Task<IActionResult> Sessions(CancellationToken ct)
    {
        var user = await users.GetUserAsync(User);
        if (user is null)
            return Unauthorized();
        var currentSession = User.FindFirstValue("sid");
        return Ok((await sessions.ListAsync(user.Id, ct)).Select(session => AccountSessionDto.From(session, user.SecurityStamp, currentSession, clock.GetUtcNow())));
    }
    [Authorize, HttpPost("sessions/{sessionId:guid}/revoke"), AllowRecoverySession, EnableRateLimiting(Authentication)]
    public async Task<IActionResult> Revoke(Guid sessionId, CancellationToken ct)
    {
        await sessions.RevokeAsync(User.FindFirstValue(ClaimTypes.NameIdentifier)!, Guard.Id(sessionId), ct);
        return NoContent();
    }

    [Authorize, HttpPost("password"), EnableRateLimiting(Authentication)]
    public async Task<ActionResult<PasswordChangeResultDto>> ChangePassword(ChangeAccountPasswordDto request,
        [FromServices] AccountPasswordService passwords, CancellationToken ct)
    {
        var result = await passwords.ChangeAsync(request, ct);
        await signIn.SignOutAsync();
        return Ok(result);
    }

    // A first password for an account made by Google or Microsoft sign-up; every session ends afterwards, as for a change.
    [Authorize, HttpPost("password/add"), EnableRateLimiting(Authentication)]
    public async Task<ActionResult<PasswordChangeResultDto>> AddPassword(AddAccountPasswordDto request,
        [FromServices] AccountPasswordService passwords, CancellationToken ct)
    {
        var result = await passwords.AddAsync(request, ct);
        await signIn.SignOutAsync();
        return Ok(result);
    }

}
