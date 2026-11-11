// Purpose: checks current account eligibility and fresh password/authenticator proofs for account-security workflows.
// Main functions: CurrentAsync, RequireMfaAsync, FreshPersonalProofAsync, PasswordAsync, AuthenticatorAsync, VerifyAsync, FailAsync, IsEligibleOperatorAsync, IsVerifiedMfaAccountAsync;
// password proof uses the configured Identity hasher without persisting a legacy rehash before the complete protected transaction.

using Microsoft.AspNetCore.Identity;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Accounts;

public class MfaAccountAccess(ParishUserManager users, SignInManager<ParishUser> signIn,
    IUserStore<ParishUser> store, ICurrentActor actor, IHttpContextAccessor context)
{
    internal IUserAuthenticatorKeyStore<ParishUser> AuthenticatorStore => (IUserAuthenticatorKeyStore<ParishUser>)store;
    internal IUserTwoFactorRecoveryCodeStore<ParishUser> RecoveryStore => (IUserTwoFactorRecoveryCodeStore<ParishUser>)store;
    internal bool RecoverySession => context.HttpContext?.User.HasClaim("amr", "recovery") == true;

    internal async Task<ParishUser> CurrentAsync(CancellationToken ct)
    {
        var user = await store.FindByIdAsync(actor.AccountId, ct);
        if (user is not { Active: true } || !AccountVerification.IsVerified(user)
            || string.IsNullOrEmpty(user.SecurityStamp) || user.PersistenceVersion is null)
            throw new DomainException("account_unavailable", "The current account is unavailable.", FailureKind.Forbidden);
        return user;
    }

    internal async Task PasswordAsync(ParishUser user, string? password)
    {
        if (password is null || password.Length > 200 || !await signIn.CanSignInAsync(user) || await users.IsLockedOutAsync(user))
            throw InvalidProof();
        // CheckPasswordSignInAsync/CheckPasswordAsync may immediately persist a legacy rehash and security stamp.
        // A fresh proof must not change credentials before later authenticator proof and the final conditional batch.
        if (user.PasswordHash is not { } hash
            || users.PasswordHasher.VerifyHashedPassword(user, hash, password) == PasswordVerificationResult.Failed)
            await FailAsync(user);
    }

    internal async Task<ParishUser> RequireMfaAsync(CancellationToken ct)
    {
        var user = await CurrentAsync(ct);
        if (!user.TwoFactorEnabled || RecoverySession || context.HttpContext?.User.HasClaim("amr", "mfa") != true || await users.IsLockedOutAsync(user))
            throw new DomainException("mfa_required", "Sign in with your authenticator before performing this action.", FailureKind.Forbidden);
        return user;
    }

    // Personal sign-in-method changes: no selected capacity or recovery cookie; MFA/operator accounts need an MFA session plus fresh
    // password and authenticator proof; ordinary members prove the current password. Proofs never leave this method.
    internal async Task<ParishUser> FreshPersonalProofAsync(string? password, string? code, CancellationToken ct)
    {
        if (actor.ActingAppointmentId is not null || RecoverySession)
            throw new DomainException("personal_security_capacity_required", "Use a normal personal sign-in before changing sign-in methods.", FailureKind.Forbidden);
        var user = await CurrentAsync(ct);
        if (await users.IsLockedOutAsync(user))
            throw new DomainException("account_unavailable", "The current account is unavailable.", FailureKind.Forbidden);
        if (user.TwoFactorEnabled || user.PlatformOperator)
        {
            user = await RequireMfaAsync(ct);
            await PasswordAsync(user, password);
            await AuthenticatorAsync(user, code);
        }
        else
            await PasswordAsync(user, password);
        return user;
    }

    internal async Task AuthenticatorAsync(ParishUser user, string? code)
    {
        if (!user.TwoFactorEnabled || !await VerifyAsync(user, code))
            await FailAsync(user);
    }

    internal Task<bool> VerifyAsync(ParishUser user, string? code) => code is null || code.Length is < 6 or > 12
        ? Task.FromResult(false)
        : users.VerifyTwoFactorTokenAsync(user, TokenOptions.DefaultAuthenticatorProvider,
            code.Replace(" ", "", StringComparison.Ordinal).Replace("-", "", StringComparison.Ordinal));

    internal async Task FailAsync(ParishUser user)
    {
        _ = await users.AccessFailedAsync(user);
        throw InvalidProof();
    }

    internal async Task<bool> IsEligibleOperatorAsync(string accountId, CancellationToken ct)
    {
        var user = await store.FindByIdAsync(accountId, ct);
        return user is { Active: true, PlatformOperator: true, TwoFactorEnabled: true }
            && AccountVerification.IsVerified(user) && !await users.IsLockedOutAsync(user);
    }

    internal async Task<bool> IsVerifiedMfaAccountAsync(string accountId, CancellationToken ct)
    {
        var user = await store.FindByIdAsync(accountId, ct);
        return user is { Active: true, TwoFactorEnabled: true } && AccountVerification.IsVerified(user)
            && !await users.IsLockedOutAsync(user);
    }

    private static DomainException InvalidProof() => new("credentials_invalid", "Current credentials could not be verified.", FailureKind.Forbidden);
}
