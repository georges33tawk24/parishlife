// Purpose: Persists Identity accounts and unique login aliases with resumable activation, ETag checks, and
// protected MFA secrets.
// Main functions: AccountKey, AliasKey, UsernameKey, CreateAsync, CompleteRegistrationAsync, UpdateAsync,
// DeleteAsync, FindByIdAsync, FindByNameAsync, FindByEmailAsync, GetUserIdAsync, GetUserNameAsync,
// SetUserNameAsync, GetNormalizedUserNameAsync, SetNormalizedUserNameAsync, SetPasswordHashAsync,
// GetPasswordHashAsync, HasPasswordAsync, SetEmailAsync, GetEmailAsync, GetEmailConfirmedAsync,
// SetEmailConfirmedAsync, GetNormalizedEmailAsync, SetNormalizedEmailAsync, SetSecurityStampAsync,
// GetSecurityStampAsync, GetLockoutEndDateAsync, SetLockoutEndDateAsync, IncrementAccessFailedCountAsync,
// ResetAccessFailedCountAsync, GetAccessFailedCountAsync, GetLockoutEnabledAsync, SetLockoutEnabledAsync,
// SetTwoFactorEnabledAsync, GetTwoFactorEnabledAsync, SetAuthenticatorKeyAsync, GetAuthenticatorKeyAsync,
// ReplaceCodesAsync, RedeemCodeAsync, CountCodesAsync, Dispose.

using System.Net;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.Azure.Cosmos;
using ParishLife.Api.Configuration;
using ParishLife.Api.Data.Cosmos;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using static ParishLife.Api.Data.Cosmos.JsonDefaults;

namespace ParishLife.Api.Identity;

internal sealed class CosmosIdentityStore(PartitionDocuments documents, TimeProvider clock, IDataProtectionProvider protection, IHttpContextAccessor context) : IUserPasswordStore<ParishUser>, IUserEmailStore<ParishUser>, IUserSecurityStampStore<ParishUser>, IUserLockoutStore<ParishUser>, IUserTwoFactorStore<ParishUser>, IUserAuthenticatorKeyStore<ParishUser>, IUserTwoFactorRecoveryCodeStore<ParishUser>
{
    internal static string AccountKey(string id) => "account:" + id;
    private static string AliasKey(string normalized) => "email:" + Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(normalized)));
    private static string UsernameKey(string normalized) => "username:" + Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(normalized)));
    private string AuditActor => context.HttpContext is null ? "external:authorized-maintenance" : context.HttpContext.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "anonymous";

    public async Task<IdentityResult> CreateAsync(ParishUser user, CancellationToken ct)
    {
        if (SuperAdminBootstrapService.IsReservedAccountId(user.Id) && !SuperAdminBootstrapService.Usernames.Any(name => name == user.UserName && SuperAdminBootstrapService.AccountIdFor(name) == user.Id))
            return IdentityResult.Failed(new IdentityError { Code = "ReservedAccountId", Description = "This registration operation is unavailable." });
        user.Active = false;
        user.IdentityVerified = false;
        user.CreatedAt = clock.GetUtcNow();
        user.PlatformOperator = false;
        var key = AccountKey(user.Id);
        var operation = new Operation
        {
            Id = Guid.NewGuid().ToString("N"),
            ActorId = AuditActor,
            Fingerprint = "identity-register-pending",
            At = clock.GetUtcNow()
        };
        using var response = await documents.Batch(Containers.Accounts, key).CreateItem(Row("account", key, "account", user)).CreateItem(Audit(key, operation, "identity.register_pending", user.Id)).ExecuteAsync(ct);
        if (response.StatusCode is HttpStatusCode.Conflict or HttpStatusCode.PreconditionFailed)
            return IdentityResult.Failed(new IdentityError { Code = "DuplicateAccount", Description = "The registration operation is already in use." });
        if (!response.IsSuccessStatusCode)
            throw new DomainException("registration_unavailable", "Registration outcome could not be confirmed. Retry with the same operation ID.", FailureKind.Unavailable);
        user.PersistenceVersion = response[0].ETag;
        return await CompleteRegistrationAsync(user, ct);
    }

    internal async Task<IdentityResult> CompleteRegistrationAsync(ParishUser user, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(user.NormalizedUserName))
            return IdentityResult.Failed(new IdentityError { Code = "InvalidUserName", Description = "A normalized username is required." });
        var aliases = new List<(string Key, string Normalized, string Kind)>
        {
            (UsernameKey(user.NormalizedUserName), user.NormalizedUserName, "username")
        };
        if (!string.IsNullOrWhiteSpace(user.NormalizedEmail))
            aliases.Add((AliasKey(user.NormalizedEmail), user.NormalizedEmail, "email"));
        foreach (var alias in aliases)
        {
            var current = await documents.ReadAsync<LoginAlias>(Containers.LoginAliases, alias.Key, "alias", ct);
            if (current is null)
            {
                try
                {
                    await documents.CreateAsync(Containers.LoginAliases, Row("alias", alias.Key, "alias", new LoginAlias(user.Id, alias.Normalized, true, alias.Kind)), ct);
                }
                catch (DomainException exception) when (exception.Code == "write_conflict")
                {
                    current = await documents.ReadAsync<LoginAlias>(Containers.LoginAliases, alias.Key, "alias", ct);
                }
            }

            if (current is not null && (current.Value.AccountId != user.Id || current.Value.NormalizedEmail != alias.Normalized))
                return IdentityResult.Failed(new IdentityError { Code = alias.Kind == "email" ? "DuplicateEmail" : "DuplicateUserName", Description = "This login identifier is already registered." });
        }

        // Activation follows successful ownership of every required alias; pending registrations cannot log in.
        user.Active = true;
        return await UpdateAsync(user, ct);
    }

    public async Task<IdentityResult> UpdateAsync(ParishUser user, CancellationToken ct)
    {
        var key = AccountKey(user.Id);
        if (user.PersistenceVersion is null)
            return IdentityResult.Failed(new IdentityErrorDescriber().ConcurrencyFailure());
        var current = await FindByIdAsync(user.Id, ct);
        if (current is null || current.NormalizedEmail != user.NormalizedEmail || current.NormalizedUserName != user.NormalizedUserName)
            return IdentityResult.Failed(new IdentityError { Code = "IdentifierChangeRequiresWorkflow", Description = "Login identifier changes require the verified alias-change workflow." });
        try
        {
            var opId = Guid.NewGuid().ToString("N");
            var op = new Operation
            {
                Id = opId,
                ActorId = AuditActor,
                Fingerprint = "identity-store-update",
                At = clock.GetUtcNow()
            };
            var batch = documents.Batch(Containers.Accounts, key).ReplaceItem("account", Row("account", key, "account", user), PartitionDocuments.Match(user.PersistenceVersion)).CreateItem(Audit(key, op, "identity.security_state_update", user.Id));
            using var result = await batch.ExecuteAsync(ct);
            if (result.StatusCode == HttpStatusCode.PreconditionFailed)
                return IdentityResult.Failed(new IdentityErrorDescriber().ConcurrencyFailure());
            if (!result.IsSuccessStatusCode)
                throw new DomainException("identity_unavailable", "Account update could not be confirmed.", FailureKind.Unavailable);
            user.PersistenceVersion = result[0].ETag;
            return IdentityResult.Success;
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.PreconditionFailed)
        {
            return IdentityResult.Failed(new IdentityErrorDescriber().ConcurrencyFailure());
        }
    }

    public Task<IdentityResult> DeleteAsync(ParishUser user, CancellationToken ct) => Task.FromResult(IdentityResult.Failed(new IdentityError { Code = "DeletionRequiresReview", Description = "Account deletion requires the retention and ownership review workflow." }));
    public async Task<ParishUser?> FindByIdAsync(string userId, CancellationToken ct)
    {
        var row = await documents.ReadAsync<ParishUser>(Containers.Accounts, AccountKey(userId), "account", ct);
        if (row is null)
            return null;
        row.Value.PersistenceVersion = row.Version;
        return row.Value;
    }

    public async Task<ParishUser?> FindByNameAsync(string normalizedUserName, CancellationToken ct)
    {
        var alias = await documents.ReadAsync<LoginAlias>(Containers.LoginAliases, UsernameKey(normalizedUserName), "alias", ct);
        if (alias?.Value.Active == true && alias.Value.NormalizedEmail == normalizedUserName)
        {
            var account = await FindByIdAsync(alias.Value.AccountId, ct);
            if (account?.Active == true && account.NormalizedUserName == normalizedUserName)
                return account;
        }

        // Existing email-as-username records retain their original alias path without a bulk migration.
        return normalizedUserName.Contains('@') ? await FindByEmailAsync(normalizedUserName, ct) : null;
    }

    public async Task<ParishUser?> FindByEmailAsync(string normalizedEmail, CancellationToken ct)
    {
        var alias = await documents.ReadAsync<LoginAlias>(Containers.LoginAliases, AliasKey(normalizedEmail), "alias", ct);
        if (alias?.Value.Active != true || alias.Value.NormalizedEmail != normalizedEmail)
            return null;
        var account = await FindByIdAsync(alias.Value.AccountId, ct);
        return account?.Active == true && account.NormalizedEmail == normalizedEmail ? account : null;
    }

    public Task<string> GetUserIdAsync(ParishUser u, CancellationToken ct) => Task.FromResult(u.Id);
    public Task<string?> GetUserNameAsync(ParishUser u, CancellationToken ct) => Task.FromResult(u.UserName);
    public Task SetUserNameAsync(ParishUser u, string? value, CancellationToken ct)
    {
        u.UserName = value;
        return Task.CompletedTask;
    }

    public Task<string?> GetNormalizedUserNameAsync(ParishUser u, CancellationToken ct) => Task.FromResult(u.NormalizedUserName);
    public Task SetNormalizedUserNameAsync(ParishUser u, string? value, CancellationToken ct)
    {
        u.NormalizedUserName = value;
        return Task.CompletedTask;
    }

    public Task SetPasswordHashAsync(ParishUser u, string? hash, CancellationToken ct)
    {
        u.PasswordHash = hash;
        return Task.CompletedTask;
    }

    public Task<string?> GetPasswordHashAsync(ParishUser u, CancellationToken ct) => Task.FromResult(u.PasswordHash);
    public Task<bool> HasPasswordAsync(ParishUser u, CancellationToken ct) => Task.FromResult(u.PasswordHash is not null);
    public Task SetEmailAsync(ParishUser u, string? email, CancellationToken ct)
    {
        u.Email = email;
        return Task.CompletedTask;
    }

    public Task<string?> GetEmailAsync(ParishUser u, CancellationToken ct) => Task.FromResult(u.Email);
    public Task<bool> GetEmailConfirmedAsync(ParishUser u, CancellationToken ct) => Task.FromResult(u.EmailConfirmed);
    public Task SetEmailConfirmedAsync(ParishUser u, bool value, CancellationToken ct)
    {
        u.EmailConfirmed = value;
        return Task.CompletedTask;
    }

    public Task<string?> GetNormalizedEmailAsync(ParishUser u, CancellationToken ct) => Task.FromResult(u.NormalizedEmail);
    public Task SetNormalizedEmailAsync(ParishUser u, string? value, CancellationToken ct)
    {
        u.NormalizedEmail = value;
        return Task.CompletedTask;
    }

    public Task SetSecurityStampAsync(ParishUser u, string stamp, CancellationToken ct)
    {
        u.SecurityStamp = stamp;
        return Task.CompletedTask;
    }

    public Task<string?> GetSecurityStampAsync(ParishUser u, CancellationToken ct) => Task.FromResult(u.SecurityStamp);
    public Task<DateTimeOffset?> GetLockoutEndDateAsync(ParishUser u, CancellationToken ct) => Task.FromResult(u.LockoutEnd);
    public Task SetLockoutEndDateAsync(ParishUser u, DateTimeOffset? end, CancellationToken ct)
    {
        u.LockoutEnd = end;
        return Task.CompletedTask;
    }

    public Task<int> IncrementAccessFailedCountAsync(ParishUser u, CancellationToken ct) => Task.FromResult(++u.AccessFailedCount);
    public Task ResetAccessFailedCountAsync(ParishUser u, CancellationToken ct)
    {
        u.AccessFailedCount = 0;
        return Task.CompletedTask;
    }

    public Task<int> GetAccessFailedCountAsync(ParishUser u, CancellationToken ct) => Task.FromResult(u.AccessFailedCount);
    public Task<bool> GetLockoutEnabledAsync(ParishUser u, CancellationToken ct) => Task.FromResult(u.LockoutEnabled);
    public Task SetLockoutEnabledAsync(ParishUser u, bool enabled, CancellationToken ct)
    {
        u.LockoutEnabled = enabled;
        return Task.CompletedTask;
    }

    public Task SetTwoFactorEnabledAsync(ParishUser u, bool enabled, CancellationToken ct)
    {
        u.TwoFactorEnabled = enabled;
        return Task.CompletedTask;
    }

    public Task<bool> GetTwoFactorEnabledAsync(ParishUser u, CancellationToken ct) => Task.FromResult(u.TwoFactorEnabled);
    public Task SetAuthenticatorKeyAsync(ParishUser u, string key, CancellationToken ct)
    {
        u.AuthenticatorKey = "dp1:" + protection.CreateProtector("ParishLife.Identity.Authenticator.v1", u.Id).Protect(key);
        return Task.CompletedTask;
    }

    public Task<string?> GetAuthenticatorKeyAsync(ParishUser u, CancellationToken ct)
    {
        if (u.AuthenticatorKey is null)
            return Task.FromResult<string?>(null);
        if (!u.AuthenticatorKey.StartsWith("dp1:", StringComparison.Ordinal))
            throw new DomainException("authenticator_upgrade_required", "The authenticator secret requires a reviewed credential upgrade.", FailureKind.Unavailable);
        return Task.FromResult<string?>(protection.CreateProtector("ParishLife.Identity.Authenticator.v1", u.Id).Unprotect(u.AuthenticatorKey[4..]));
    }

    public Task ReplaceCodesAsync(ParishUser user, IEnumerable<string> recoveryCodes, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();
        var codes = recoveryCodes.Select(NormalizeRecoveryCode).Distinct(StringComparer.Ordinal).ToArray();
        if (codes.Length > 20 || codes.Any(code => code.Length is < 8 or > 32 || code.Any(c => !char.IsAsciiLetterOrDigit(c))))
            throw new InvalidOperationException("Use bounded Identity recovery codes.");
        user.ProtectedRecoveryCodes = "dp1:" + protection.CreateProtector("ParishLife.Identity.RecoveryCodes.v1", user.Id).Protect(string.Join(';', codes));
        return Task.CompletedTask;
    }

    public async Task<bool> RedeemCodeAsync(ParishUser user, string code, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();
        var supplied = Encoding.UTF8.GetBytes(NormalizeRecoveryCode(code));
        var codes = RecoveryCodes(user);
        var found = -1;
        for (var index = 0; index < codes.Length; index++)
        {
            if (CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(codes[index]), supplied))
                found = index;
        }
        if (found < 0)
            return false;
        await ReplaceCodesAsync(user, codes.Where((_, index) => index != found), ct);
        return true;
    }

    public Task<int> CountCodesAsync(ParishUser user, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();
        return Task.FromResult(RecoveryCodes(user).Length);
    }

    private string[] RecoveryCodes(ParishUser user)
    {
        if (user.ProtectedRecoveryCodes is null)
            return [];
        if (!user.ProtectedRecoveryCodes.StartsWith("dp1:", StringComparison.Ordinal))
            throw new DomainException("recovery_codes_upgrade_required", "Recovery codes require reviewed recovery.", FailureKind.Unavailable);
        return protection.CreateProtector("ParishLife.Identity.RecoveryCodes.v1", user.Id)
            .Unprotect(user.ProtectedRecoveryCodes[4..]).Split(';', StringSplitOptions.RemoveEmptyEntries);
    }

    private static string NormalizeRecoveryCode(string code) => code.Replace(" ", "", StringComparison.Ordinal).Replace("-", "", StringComparison.Ordinal).ToUpperInvariant();

    public void Dispose()
    {
    }
}
