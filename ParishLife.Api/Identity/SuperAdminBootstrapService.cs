// Purpose: configures only colinsleiman and georgestawk through an explicit, credential-protected operator flow.
// Main functions: IsReservedUsername, IsReservedAccountId, AccountIdFor, PrepareAsync, CompleteAsync, Ensure.

using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Identity;

public sealed class SuperAdminBootstrapService(UserManager<ParishUser> users, IUserStore<ParishUser> store)
{
    public static IReadOnlyList<string> Usernames { get; } = Array.AsReadOnly(new[] { "colinsleiman", "georgestawk" });

    public static bool IsReservedUsername(string? username) => username is not null && Usernames.Contains(username, StringComparer.OrdinalIgnoreCase);
    internal static string AccountIdFor(string username) => new Guid(SHA256.HashData(Encoding.UTF8.GetBytes("ParishLife.SuperAdmin.v1:" + username.ToLowerInvariant()))[..16]).ToString("N");
    internal static bool IsReservedAccountId(string id) => Usernames.Any(username => AccountIdFor(username) == id);
    public async Task<ParishUser> PrepareAsync(string username, string password, string verificationReference, CancellationToken ct)
    {
        if (!Usernames.Contains(username, StringComparer.Ordinal))
            throw new DomainException("bootstrap_username_forbidden", "Only the two exact configured usernames may be bootstrapped.");
        if (password.Length is < 16 or > 200)
            throw new DomainException("invalid_password", "Use 16–200 characters.");
        var reference = Guard.Text(verificationReference, "Operator verification reference", 500);
        var id = AccountIdFor(username);
        var current = await users.FindByNameAsync(username);
        if (current is not null && current.Id != id)
            throw new DomainException("bootstrap_identity_conflict", "An existing account needs deliberate identity review; no account was elevated.", FailureKind.Conflict);
        var user = await users.FindByIdAsync(id);
        if (user is null)
        {
            user = new ParishUser
            {
                Id = id,
                UserName = username,
                DisplayName = username,
                LockoutEnabled = true
            };
            Ensure(await users.CreateAsync(user, password));
        }
        else
        {
            if (user.UserName != username || !await users.CheckPasswordAsync(user, password))
                throw new DomainException("bootstrap_credentials_invalid", "Existing bootstrap credentials were not verified.", FailureKind.Forbidden);
            if (!user.Active && store is CosmosIdentityStore cosmos)
                Ensure(await cosmos.CompleteRegistrationAsync(user, ct));
        }

        user.ContactVerificationReference = reference;
        user.IdentityVerified = true;
        Ensure(await users.UpdateAsync(user));
        return user;
    }

    public async Task CompleteAsync(ParishUser user, string? authenticatorSecret, string currentCode, CancellationToken ct)
    {
        if (!Usernames.Contains(user.UserName, StringComparer.Ordinal) || user.Id != AccountIdFor(user.UserName!))
            throw new DomainException("bootstrap_identity_conflict", "The account is not an authorized bootstrap identity.");
        if (!user.TwoFactorEnabled)
        {
            if (authenticatorSecret is null || authenticatorSecret.Length is < 32 or > 128 || authenticatorSecret.Any(character => !"ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".Contains(character)))
                throw new DomainException("invalid_authenticator_secret", "Provide a private Base32 authenticator secret of at least 32 characters.");
            await ((IUserAuthenticatorKeyStore<ParishUser>)store).SetAuthenticatorKeyAsync(user, authenticatorSecret, ct);
        }

        if (!await users.VerifyTwoFactorTokenAsync(user, TokenOptions.DefaultAuthenticatorProvider, currentCode.Replace(" ", "", StringComparison.Ordinal)))
            throw new DomainException("bootstrap_mfa_invalid", "The authenticator code was not verified; no administrator privilege was granted.");
        if (user.PlatformOperator && user.TwoFactorEnabled)
            return;
        user.PlatformOperator = true;
        user.TwoFactorEnabled = true;
        Ensure(await users.UpdateAsync(user));
        Ensure(await users.UpdateSecurityStampAsync(user));
    }

    private static void Ensure(IdentityResult result)
    {
        if (!result.Succeeded)
            throw new DomainException("bootstrap_failed", "Identity operation failed: " + string.Join(", ", result.Errors.Select(error => error.Code)), FailureKind.Conflict);
    }
}
