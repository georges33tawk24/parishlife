// Purpose: optional external sign-in (A06). Providers exist only when configured; linking needs an MFA-authenticated account with
// fresh proofs; sign-in only resolves an explicitly linked subject and never creates an account, Person or membership, and never
// merges by a claimed email. An external login is one factor: MFA accounts still complete their authenticator challenge.
// Main functions: AvailableAsync, ListAsync, ChallengeProperties (sign-in/link), CompleteAsync, UnlinkAsync.

using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authentication;
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
    AccountSessionService sessions, TimeProvider clock)
{
    public const string CompletePath = "/api/auth/external/complete";
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

    public async Task<AuthenticationProperties> SignInPropertiesAsync(string provider)
    {
        await RequireProviderAsync(provider);
        return Properties(provider, "sign-in");
    }

    public async Task<AuthenticationProperties> LinkPropertiesAsync(string provider, LinkExternalLoginDto request, CancellationToken ct)
    {
        await RequireProviderAsync(provider);
        var user = await proof.FreshPersonalProofAsync(request.CurrentPassword, request.CurrentCode, ct);
        if (!user.TwoFactorEnabled)
            throw new DomainException("mfa_required", "Enroll an authenticator before linking an external sign-in provider.", FailureKind.Forbidden);
        if (user.ExternalLogins.Any(login => login.Provider == provider))
            throw new DomainException("external_login_exists", "Unlink the existing account for this provider first.", FailureKind.Conflict);
        var properties = Properties(provider, "link");
        properties.Items["account"] = user.Id;
        properties.Items["sid"] = Http.User.FindFirstValue("sid");
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

    private static AuthenticationProperties Properties(string provider, string mode)
    {
        var properties = new AuthenticationProperties { RedirectUri = CompletePath };
        properties.Items["provider"] = provider;
        properties.Items["mode"] = mode;
        properties.Items["nonce"] = Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant();
        return properties;
    }

    private static string HashText(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

    private static AccountSecurityChangeDto Change(string operation, string status, string id) => new()
    { OperationId = operation, Status = status, ResourceId = id, RequiresSignIn = true };

    private static DomainException Capacity() => new("personal_security_capacity_required", "Use a normal personal sign-in.", FailureKind.Forbidden);
}
