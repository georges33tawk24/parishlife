// Purpose: Resolves verified account and current MFA-protected platform authority from stored facts rather than
// client role claims.
// Main functions: IsActiveVerifiedAsync, FindIdAsync (by username or email), RequireOperatorAsync and IsOperatorAsync (same rule as
// a yes/no answer; a recovery session or a selected appointment is never an operator).

using Microsoft.AspNetCore.Identity;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Identity;

internal sealed class AccountDirectory(IUserStore<ParishUser> store) : IAccountDirectory
{
    public async Task<bool> IsActiveVerifiedAsync(string accountId, CancellationToken ct)
    {
        var account = await store.FindByIdAsync(accountId, ct);
        return account is { Active: true } && AccountVerification.IsVerified(account);
    }

    public async Task<string?> FindIdAsync(string usernameOrEmail, CancellationToken ct)
    {
        var normalized = usernameOrEmail.Trim().ToUpperInvariant();
        var account = await store.FindByNameAsync(normalized, ct)
            ?? (store is IUserEmailStore<ParishUser> emails ? await emails.FindByEmailAsync(normalized, ct) : null);
        return account?.Id;
    }
}

internal sealed class PlatformAccess(IHttpContextAccessor context, ICurrentActor actor, IUserStore<ParishUser> store) : IPlatformAccess
{
    public async Task RequireOperatorAsync(CancellationToken ct)
    {
        if (actor.ActingAppointmentId is not null)
            throw new DomainException("platform_capacity_required", "Leave the selected organizational appointment before performing a platform operation.", FailureKind.Forbidden);
        if (!await IsOperatorAsync(ct))
            throw new DomainException("operator_required", "A current platform billing/verification operator with MFA is required.", FailureKind.Forbidden);
    }

    // Active, verified, PlatformOperator with two-factor enabled, signed in with the mfa method (a recovery cookie carries
    // amr=recovery and never passes), and acting in personal capacity (no selected appointment).
    public async Task<bool> IsOperatorAsync(CancellationToken ct)
    {
        if (actor.ActingAppointmentId is not null || context.HttpContext?.User.HasClaim("amr", "mfa") != true)
            return false;
        var user = await store.FindByIdAsync(actor.AccountId, ct);
        return user is { Active: true, PlatformOperator: true, TwoFactorEnabled: true } && AccountVerification.IsVerified(user);
    }
}
