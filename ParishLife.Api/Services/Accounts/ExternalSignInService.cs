// Purpose: optional external sign-in (A06). Providers exist only when configured; linking needs an MFA-authenticated account with
// fresh proofs; sign-in only resolves an explicitly linked subject and never creates an account, Person or membership, and never
// merges by a claimed email. An external login is one factor: MFA accounts still complete their authenticator challenge.
// Main functions: AvailableAsync, ListAsync, SignInPropertiesAsync and LinkPropertiesAsync (provider challenges), LinkTicketAsync and
// LinkFromTicketAsync (proof over JSON, then a credential-free browser form post), HoldPendingChallenge/TakePendingChallenge (the MFA
// challenge of a portal round trip, via a protected HttpOnly cookie), CompleteAsync and UnlinkAsync.

using System.Globalization;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using ParishLife.Api.Configuration;
using ParishLife.Api.DTOs.Accounts;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Accounts;

public class ExternalSignInService(IRecordTransactions records, MfaAccountAccess proof, ParishUserManager users,
    IUserStore<ParishUser> store, IAuthenticationSchemeProvider schemes, IHttpContextAccessor context,
    AccountSessionService sessions, TimeProvider clock, IDataProtectionProvider protection)
{
    public const string CompletePath = "/api/auth/external/complete";
    public const string ChallengeCookie = "__Host-ParishLife.ExternalMfa";
    private const string TicketPurpose = "ParishLife.ExternalLinkTicket.v1";
    private const string ChallengePurpose = "ParishLife.ExternalMfaChallenge.v1";
    private static readonly TimeSpan TicketLifetime = TimeSpan.FromMinutes(2);
    private CosmosIdentityStore Store => (CosmosIdentityStore)store;
    private HttpContext Http => context.HttpContext ?? throw new InvalidOperationException("External sign-in requires an HTTP request.");

    public async Task<bool> AvailableAsync(string provider)
        => ExternalProviderOptions.Providers.ContainsKey(provider) && await schemes.GetSchemeAsync(ExternalProviderOptions.SchemePrefix + provider) is not null;

    public async Task<IReadOnlyList<ExternalLoginDto>> ListAsync(CancellationToken ct)
    {
        if (proof.RecoverySession)
            throw Capacity();
        var user = await proof.CurrentAsync(ct);
        if (user.TwoFactorEnabled || user.PlatformOperator)
            user = await proof.RequireMfaAsync(ct);
        return user.ExternalLogins.Select(login => new ExternalLoginDto { Provider = login.Provider, LinkedAt = login.LinkedAt }).ToList();
    }

    public async Task<AuthenticationProperties> SignInPropertiesAsync(string provider, bool portal = false)
    {
        await RequireProviderAsync(provider);
        return Properties(provider, "sign-in", portal);
    }

    public async Task<AuthenticationProperties> LinkPropertiesAsync(string provider, LinkExternalLoginDto request, CancellationToken ct)
    {
        var user = await LinkProofAsync(provider, request, ct);
        return LinkProperties(provider, user, Http.User.FindFirstValue("sid"), false);
    }

    // Checks the same fresh proof as LinkPropertiesAsync over JSON, then hands back a two-minute ticket bound to this account, this
    // session, its security stamp and the provider, so the browser can start the provider redirect with a credential-free form post.
    public async Task<ExternalLinkTicketDto> LinkTicketAsync(string provider, LinkExternalLoginDto request, CancellationToken ct)
    {
        var user = await LinkProofAsync(provider, request, ct);
        var expires = clock.GetUtcNow().Add(TicketLifetime);
        var payload = string.Join('\n', user.Id, Http.User.FindFirstValue("sid") ?? string.Empty, HashText(user.SecurityStamp!), provider,
            expires.ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture));
        var ticket = protection.CreateProtector(TicketPurpose).Protect(payload);
        return new ExternalLinkTicketDto { Ticket = ticket, ExpiresAt = expires };
    }

    // The form post that follows LinkTicketAsync: the ticket must still be valid for the same account, session, stamp and provider.
    public async Task<AuthenticationProperties> LinkFromTicketAsync(string provider, StartExternalLinkDto request, CancellationToken ct)
    {
        await RequireProviderAsync(provider);
        if (proof.RecoverySession)
            throw Capacity();
        var user = await proof.RequireMfaAsync(ct);
        string payload;
        try
        {
            payload = protection.CreateProtector(TicketPurpose).Unprotect(request.Ticket);
        }
        catch (CryptographicException)
        { throw TicketInvalid(); }
        var sid = Http.User.FindFirstValue("sid");
        var parts = payload.Split('\n');
        if (parts.Length != 5 || !long.TryParse(parts[4], NumberStyles.None, CultureInfo.InvariantCulture, out var until)
            || DateTimeOffset.FromUnixTimeSeconds(until) < clock.GetUtcNow() || parts[0] != user.Id || parts[1] != (sid ?? string.Empty) || parts[2] != HashText(user.SecurityStamp!) || parts[3] != provider)
            throw TicketInvalid();
        if (!user.TwoFactorEnabled)
            throw new DomainException("mfa_required", "Enroll an authenticator before linking an external sign-in provider.", FailureKind.Forbidden);
        if (user.ExternalLogins.Any(login => login.Provider == provider))
            throw new DomainException("external_login_exists", "Unlink the existing account for this provider first.", FailureKind.Conflict);
        return LinkProperties(provider, user, sid, request.ReturnTo == "portal");
    }

    // A two-factor challenge from a provider round trip that returns to the portal: kept in a protected, HttpOnly, Strict cookie and
    // handed to the portal's own script once (TakePendingChallenge), so the challenge never appears in an address.
    public void HoldPendingChallenge(MfaLoginChallengeDto challenge)
    {
        var expires = challenge.ExpiresAt < clock.GetUtcNow().AddMinutes(10) ? challenge.ExpiresAt : clock.GetUtcNow().AddMinutes(10);
        var value = protection.CreateProtector(ChallengePurpose).Protect(JsonSerializer.Serialize(challenge));
        Http.Response.Cookies.Append(ChallengeCookie, value, new CookieOptions
        { HttpOnly = true, Secure = true, SameSite = SameSiteMode.Strict, Path = "/", MaxAge = expires - clock.GetUtcNow(), IsEssential = true });
    }

    public MfaLoginChallengeDto? TakePendingChallenge()
    {
        if (!Http.Request.Cookies.TryGetValue(ChallengeCookie, out var value) || string.IsNullOrEmpty(value))
            return null;
        Http.Response.Cookies.Delete(ChallengeCookie, new CookieOptions { HttpOnly = true, Secure = true, SameSite = SameSiteMode.Strict, Path = "/" });
        try
        {
            // The challenge carries its own expiry; login/mfa rechecks it, its account binding and its one-time use.
            var held = JsonSerializer.Deserialize<MfaLoginChallengeDto>(protection.CreateProtector(ChallengePurpose).Unprotect(value));
            return held is null || held.ExpiresAt <= clock.GetUtcNow() ? null : held;
        }
        catch (Exception error) when (error is CryptographicException or JsonException)
        { return null; }
    }

    private async Task<ParishUser> LinkProofAsync(string provider, LinkExternalLoginDto request, CancellationToken ct)
    {
        await RequireProviderAsync(provider);
        var user = await proof.FreshPersonalProofAsync(request.CurrentPassword, request.CurrentCode, ct);
        if (!user.TwoFactorEnabled)
            throw new DomainException("mfa_required", "Enroll an authenticator before linking an external sign-in provider.", FailureKind.Forbidden);
        if (user.ExternalLogins.Any(login => login.Provider == provider))
            throw new DomainException("external_login_exists", "Unlink the existing account for this provider first.", FailureKind.Conflict);
        return user;
    }

    private static AuthenticationProperties LinkProperties(string provider, ParishUser user, string? sid, bool portal)
    {
        var properties = Properties(provider, "link", portal);
        properties.Items["account"] = user.Id;
        properties.Items["sid"] = sid;
        properties.Items["stamp"] = HashText(user.SecurityStamp!);
        return properties;
    }

    // Completes the provider round trip from the temporary external cookie. Returns null for any unusable or unlinked result.
    public async Task<(string Mode, ParishUser User, AccountSession? Session, MfaLoginChallengeDto? Challenge)?> CompleteAsync(CancellationToken ct)
    {
        var external = await Http.AuthenticateAsync(IdentityConstants.ExternalScheme);
        await Http.SignOutAsync(IdentityConstants.ExternalScheme);
        var items = external.Properties?.Items;
        var subject = external.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!external.Succeeded || items is null || subject is null || subject.Length > 512
            || !items.TryGetValue("provider", out var provider) || provider is null || !await AvailableAsync(provider)
            || !items.TryGetValue("mode", out var mode) || !items.TryGetValue("nonce", out var nonce) || nonce is null)
            return null;
        var hash = HashText(provider + "\n" + subject);
        return mode == "link" ? await LinkAsync(provider, hash, items, nonce, ct) : await SignInAsync(provider, hash, nonce, ct);
    }

    public async Task<AccountSecurityChangeDto> UnlinkAsync(string provider, UnlinkExternalLoginDto request, CancellationToken ct)
    {
        var user = await proof.FreshPersonalProofAsync(request.CurrentPassword, request.CurrentCode, ct);
        var scope = MfaRecoveryService.Scope(user.Id);
        var operation = Operation.Create(request.OperationId, user.Id, new { Kind = "external.unlink", Provider = provider }, clock, "account-external:v1");
        if (await records.ReplayAsync<CommandResult>(scope, operation, ct) is not null)
            return Change(operation.Id, "AlreadyApplied", provider);
        var login = user.ExternalLogins.FirstOrDefault(item => item.Provider == provider)
            ?? throw new DomainException("external_login_not_found", "No account is linked for this provider.", FailureKind.NotFound);
        if (user.PasswordHash is null && user.Passkeys.Count == 0 && user.ExternalLogins.Count == 1)
            throw new DomainException("last_sign_in_method", "Add another sign-in method before unlinking this provider.", FailureKind.Conflict);
        user.ExternalLogins.Remove(login);
        user.SecurityStamp = users.CreateSecurityStamp();
        await records.CommitAsync(scope, operation, "identity.external_login.unlinked", provider,
            [RecordChange.Replace("account", "account", user, user.PersistenceVersion!)], new CommandResult { Id = provider, Status = "Unlinked" }, ct);
        await Store.ReleaseAliasAsync(user.Id, "external", provider + ":" + login.SubjectHash, ct);
        return Change(operation.Id, "Applied", provider);
    }

    private async Task<(string, ParishUser, AccountSession?, MfaLoginChallengeDto?)?> LinkAsync(string provider, string hash,
        IDictionary<string, string?> items, string nonce, CancellationToken ct)
    {
        // The application cookie may not accompany a cross-site provider redirect, so the bound MFA session is rechecked from storage.
        if (!items.TryGetValue("account", out var accountId) || accountId is null || !items.TryGetValue("sid", out var sid) || sid is null)
            return null;
        var user = await store.FindByIdAsync(accountId, ct);
        if (user is not { Active: true, TwoFactorEnabled: true } || !AccountVerification.IsVerified(user) || await users.IsLockedOutAsync(user)
            || (items.TryGetValue("stamp", out var stamp) ? stamp : null) != HashText(user.SecurityStamp!) || !await sessions.ValidAsync(user.Id, sid, user.SecurityStamp!, ct, "mfa")
            || user.ExternalLogins.Any(login => login.Provider == provider))
            return null;
        var key = provider + ":" + hash;
        if (!await Store.ClaimAliasAsync(user.Id, "external", key, ct))
            throw new DomainException("external_login_in_use", "This external account is already linked to another sign-in.", FailureKind.Conflict);
        user.ExternalLogins.Add(new AccountExternalLogin { Provider = provider, SubjectHash = hash, LinkedAt = clock.GetUtcNow() });
        try
        {
            // The nonce is the one-use operation identity of this provider round trip.
            var operation = new Operation { Id = nonce, ActorId = user.Id, Fingerprint = "external-link:" + provider, At = clock.GetUtcNow() };
            await records.CommitAsync(MfaRecoveryService.Scope(user.Id), operation, "identity.external_login.linked", provider,
                [RecordChange.Replace("account", "account", user, user.PersistenceVersion!)], new CommandResult { Id = provider, Status = "Linked" }, ct);
        }
        catch
        {
            await Store.ReleaseAliasAsync(user.Id, "external", key, CancellationToken.None);
            throw;
        }
        return ("link", user, null, null);
    }

    private async Task<(string, ParishUser, AccountSession?, MfaLoginChallengeDto?)?> SignInAsync(string provider, string hash, string nonce, CancellationToken ct)
    {
        var owner = await Store.FindAliasOwnerAsync("external", provider + ":" + hash, ct);
        var user = owner is null ? null : await store.FindByIdAsync(owner, ct);
        if (user is not { Active: true } || !AccountVerification.IsVerified(user) || await users.IsLockedOutAsync(user)
            || !user.ExternalLogins.Any(login => login.Provider == provider && login.SubjectHash == hash))
            return null;
        try
        {
            if (user.TwoFactorEnabled)
                return ("sign-in", user, null, await sessions.CreateChallengeAsync(user, ct, nonce));
            if (user.PlatformOperator)
                return null;
            return ("sign-in", user, await sessions.CreateFirstFactorAsync(user, "external", nonce, ct), null);
        }
        catch (DomainException error) when (error.Code is "write_conflict" or "account_unavailable" or "mfa_required")
        { return null; }
    }

    private async Task RequireProviderAsync(string provider)
    {
        if (!await AvailableAsync(provider))
            throw new DomainException("external_provider_unavailable", "This sign-in provider is not configured.", FailureKind.NotFound);
    }

    private static AuthenticationProperties Properties(string provider, string mode, bool portal)
    {
        // The portal flag only chooses how Complete answers (a redirect to the fixed portal page, never a caller-chosen address).
        var properties = new AuthenticationProperties { RedirectUri = portal ? CompletePath + "?return=portal" : CompletePath };
        properties.Items["provider"] = provider;
        properties.Items["mode"] = mode;
        properties.Items["nonce"] = Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant();
        return properties;
    }

    private static string HashText(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

    private static AccountSecurityChangeDto Change(string operation, string status, string id) => new()
    { OperationId = operation, Status = status, ResourceId = id, RequiresSignIn = true };

    private static DomainException TicketInvalid() =>
        new("external_link_ticket_invalid", "The link request expired or belongs to another sign-in. Confirm your password again.");

    private static DomainException Capacity() => new("personal_security_capacity_required", "Use a normal personal sign-in.", FailureKind.Forbidden);
}
