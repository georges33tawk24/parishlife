// Purpose: registers, lists, removes and signs in with WebAuthn passkeys through ASP.NET Core Identity's passkey handler,
// keeping ceremony state server-protected, one-use and bound to the account/session, and commits through account transactions.
// Main functions: ListAsync, BeginRegistrationAsync, CompleteRegistrationAsync, RemoveAsync, BeginLoginAsync, CompleteLoginAsync.
// A passkey is one sign-in factor: it never produces an "mfa" session; MFA/operator accounts still complete the authenticator challenge.

using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using ParishLife.Api.DTOs.Accounts;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Accounts;

public class PasskeyService(IRecordTransactions records, MfaAccountAccess proof, ParishUserManager users,
    IUserStore<ParishUser> store, IPasskeyHandler<ParishUser> passkeys, IDataProtectionProvider protection,
    IHttpContextAccessor context, ICurrentActor actor, AccountSessionService sessions, TimeProvider clock)
{
    internal const int MaximumPasskeys = 10; // ponytail: bounded per-account list on the account document; raise with a separate container.
    private static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(5);
    private CosmosIdentityStore Store => (CosmosIdentityStore)store;
    private HttpContext Http => context.HttpContext ?? throw new InvalidOperationException("Passkey ceremonies require an HTTP request.");

    public async Task<IReadOnlyList<PasskeyDto>> ListAsync(CancellationToken ct)
    {
        var user = await PersonalAsync(ct);
        return user.Passkeys.Select(View).ToList();
    }

    public async Task<PasskeyCeremonyDto> BeginRegistrationAsync(BeginPasskeyRegistrationDto request, CancellationToken ct)
    {
        var user = await proof.FreshPersonalProofAsync(request.CurrentPassword, request.CurrentCode, ct);
        if (user.Passkeys.Count >= MaximumPasskeys)
            throw new DomainException("passkey_limit_reached", "Remove an existing passkey before registering another.", FailureKind.Conflict);
        var options = await passkeys.MakeCreationOptionsAsync(new PasskeyUserEntity
        {
            Id = user.Id,
            Name = user.UserName ?? user.Id,
            DisplayName = string.IsNullOrWhiteSpace(user.DisplayName) ? user.UserName ?? user.Id : user.DisplayName
        }, Http);
        return Issue("register", options.AttestationState, options.CreationOptionsJson, user);
    }

    public async Task<PasskeyDto> CompleteRegistrationAsync(CompletePasskeyRegistrationDto request, CancellationToken ct)
    {
        var user = await PersonalAsync(ct);
        var name = request.Name is null ? "Passkey" : Guard.Text(request.Name, "Passkey name", 100);
        if (name.Any(char.IsControl))
            throw new DomainException("invalid_input", "Passkey name must not contain control characters.");
        var scope = MfaRecoveryService.Scope(user.Id);
        // The attestation is public-key material, not a secret; it is still kept out of the fingerprint, receipt and audit.
        var operation = Operation.Create(request.OperationId, user.Id, new { Kind = "passkey.register", Name = name }, clock, "account-passkey:v1");
        if (await records.ReplayAsync<CommandResult>(scope, operation, ct) is { } prior)
            return View(user.Passkeys.FirstOrDefault(p => p.CredentialId == prior.Id)
                ?? throw new DomainException("passkey_removed", "This registration was applied and the passkey has since been removed.", FailureKind.Conflict));
        var ceremony = Open(request.State, "register");
        if (ceremony.AccountId != user.Id || ceremony.SessionId != SessionId || ceremony.SecurityStamp != user.SecurityStamp)
            throw InvalidCeremony();
        if (user.Passkeys.Count >= MaximumPasskeys)
            throw new DomainException("passkey_limit_reached", "Remove an existing passkey before registering another.", FailureKind.Conflict);
        var result = await passkeys.PerformAttestationAsync(new PasskeyAttestationContext
        {
            CredentialJson = request.Credential,
            AttestationState = ceremony.State,
            HttpContext = Http
        });
        if (!result.Succeeded || result.UserEntity.Id != user.Id)
            throw new DomainException("passkey_invalid", "The passkey could not be verified. Start registration again.");
        var credentialId = CosmosIdentityStore.Base64Url(result.Passkey.CredentialId);
        if (!await Store.ClaimAliasAsync(user.Id, "passkey", credentialId, ct))
            throw new DomainException("passkey_already_registered", "This passkey is already registered.", FailureKind.Conflict);
        result.Passkey.Name = name;
        await Store.AddOrUpdatePasskeyAsync(user, result.Passkey, ct);
        try
        {
            var outcome = await records.CommitAsync(scope, operation, "identity.passkey.registered", credentialId,
                [RecordChange.Replace("account", "account", user, user.PersistenceVersion!)],
                new CommandResult { Id = credentialId, Status = "Registered" }, ct);
            if (outcome.Id != credentialId)
                throw new DomainException("operation_reused", "This operation already registered a different passkey.", FailureKind.Conflict);
        }
        catch
        {
            await Store.ReleaseAliasAsync(user.Id, "passkey", credentialId, CancellationToken.None);
            throw;
        }
        return View(user.Passkeys.First(p => p.CredentialId == credentialId));
    }

    public async Task<AccountSecurityChangeDto> RemoveAsync(string credentialId, RemovePasskeyDto request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(credentialId) || credentialId.Length > 1400)
            throw new DomainException("invalid_input", "A passkey identifier is required.");
        var user = await proof.FreshPersonalProofAsync(request.CurrentPassword, request.CurrentCode, ct);
        var scope = MfaRecoveryService.Scope(user.Id);
        var operation = Operation.Create(request.OperationId, user.Id, new { Kind = "passkey.remove", CredentialId = credentialId }, clock, "account-passkey:v1");
        if (await records.ReplayAsync<CommandResult>(scope, operation, ct) is not null)
            return Change(operation.Id, "AlreadyApplied", credentialId);
        if (user.Passkeys.All(p => p.CredentialId != credentialId))
            throw new DomainException("passkey_not_found", "The passkey was not found.", FailureKind.NotFound);
        // S06.11 (proposed): never remove the only usable sign-in method without a confirmed alternative.
        if (user.PasswordHash is null && user.Passkeys.Count == 1 && user.ExternalLogins.Count == 0)
            throw new DomainException("last_sign_in_method", "Add another sign-in method before removing this passkey.", FailureKind.Conflict);
        user.Passkeys.RemoveAll(p => p.CredentialId == credentialId);
        user.SecurityStamp = users.CreateSecurityStamp(); // Sessions that may have used the removed passkey end now.
        user.AccessFailedCount = 0;
        await records.CommitAsync(scope, operation, "identity.passkey.removed", credentialId,
            [RecordChange.Replace("account", "account", user, user.PersistenceVersion!)], new CommandResult { Id = credentialId, Status = "Removed" }, ct);
        await Store.ReleaseAliasAsync(user.Id, "passkey", credentialId, ct);
        return Change(operation.Id, "Applied", credentialId);
    }

    public async Task<PasskeyCeremonyDto> BeginLoginAsync()
    {
        // Discoverable-credential request: no identifier is supplied, so the call reveals nothing about which accounts exist.
        var options = await passkeys.MakeRequestOptionsAsync(null, Http);
        return Issue("login", options.AssertionState, options.RequestOptionsJson, null);
    }

    public async Task<(ParishUser User, AccountSession? Session, MfaLoginChallengeDto? Challenge)?> CompleteLoginAsync(CompletePasskeyLoginDto request, CancellationToken ct)
    {
        Ceremony ceremony;
        try
        { ceremony = Open(request.State, "login"); }
        catch (DomainException) { return null; }
        var result = await passkeys.PerformAssertionAsync(new PasskeyAssertionContext
        {
            CredentialJson = request.Credential,
            AssertionState = ceremony.State,
            HttpContext = Http
        });
        if (!result.Succeeded || result.User is not { Active: true } user || !AccountVerification.IsVerified(user)
            || await users.IsLockedOutAsync(user) || user.PersistenceVersion is null)
            return null;
        await Store.AddOrUpdatePasskeyAsync(user, result.Passkey, ct);
        try
        {
            if (user.TwoFactorEnabled)
                return (user, null, await sessions.CreateChallengeAsync(user, ct, ceremony.Nonce));
            if (user.PlatformOperator)
                return null;
            return (user, await sessions.CreateFirstFactorAsync(user, "passkey", ceremony.Nonce, ct), null);
        }
        catch (DomainException error) when (error.Code is "write_conflict" or "account_unavailable" or "mfa_required")
        { return null; } // Replayed ceremony or concurrent account change: sign in again.
    }

    private async Task<ParishUser> PersonalAsync(CancellationToken ct)
    {
        if (actor.ActingAppointmentId is not null || proof.RecoverySession)
            throw new DomainException("personal_security_capacity_required", "Use a normal personal sign-in to manage passkeys.", FailureKind.Forbidden);
        var user = await proof.CurrentAsync(ct);
        return user.TwoFactorEnabled || user.PlatformOperator ? await proof.RequireMfaAsync(ct) : user;
    }

    private string? SessionId => Http.User.FindFirst("sid")?.Value;

    private PasskeyCeremonyDto Issue(string purpose, string? state, string optionsJson, ParishUser? user)
    {
        var ceremony = new Ceremony
        {
            Purpose = purpose,
            Nonce = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)),
            AccountId = user?.Id,
            SessionId = user is null ? null : SessionId,
            SecurityStamp = user?.SecurityStamp,
            State = state,
            ExpiresAt = clock.GetUtcNow().Add(Lifetime)
        };
        return new PasskeyCeremonyDto
        {
            State = Protector.Protect(JsonSerializer.Serialize(ceremony)),
            OptionsJson = optionsJson,
            ExpiresAt = ceremony.ExpiresAt
        };
    }

    private Ceremony Open(string token, string purpose)
    {
        Ceremony? ceremony;
        try
        { ceremony = JsonSerializer.Deserialize<Ceremony>(Protector.Unprotect(token)); }
        catch (Exception error) when (error is CryptographicException or JsonException or FormatException) { throw InvalidCeremony(); }
        if (ceremony is null || ceremony.Purpose != purpose || ceremony.ExpiresAt <= clock.GetUtcNow())
            throw InvalidCeremony();
        return ceremony;
    }

    private IDataProtector Protector => protection.CreateProtector("ParishLife.Identity.PasskeyCeremony.v1");

    private static PasskeyDto View(AccountPasskey passkey) => new()
    {
        Id = passkey.CredentialId,
        Name = passkey.Name,
        CreatedAt = passkey.CreatedAt,
        LastUsedAt = passkey.LastUsedAt,
        IsBackedUp = passkey.IsBackedUp
    };

    private static AccountSecurityChangeDto Change(string operation, string status, string id) => new()
    { OperationId = operation, Status = status, ResourceId = id, RequiresSignIn = true };

    private static DomainException InvalidCeremony() => new("passkey_ceremony_invalid", "This passkey ceremony expired or belongs to another sign-in. Start again.", FailureKind.Conflict);

    private sealed class Ceremony
    {
        public string Purpose { get; set; } = string.Empty;
        public string Nonce { get; set; } = string.Empty;
        public string? AccountId { get; set; }
        public string? SessionId { get; set; }
        public string? SecurityStamp { get; set; }
        public string? State { get; set; }
        public DateTimeOffset ExpiresAt { get; set; }
    }
}
