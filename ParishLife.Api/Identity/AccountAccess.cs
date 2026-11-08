// Purpose: Resolves verified account and current MFA-protected platform authority from stored facts rather than
// client role claims.
// Main functions: IsActiveVerifiedAsync, RequireOperatorAsync.

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
}

internal sealed class PlatformAccess(IHttpContextAccessor context, ICurrentActor actor, IUserStore<ParishUser> store) : IPlatformAccess
{
    public async Task RequireOperatorAsync(CancellationToken ct)
    {
        if (actor.ActingAppointmentId is not null)
            throw new DomainException("platform_capacity_required", "Leave the selected organizational appointment before performing a platform operation.", FailureKind.Forbidden);
        var user = await store.FindByIdAsync(actor.AccountId, ct);
        if (user is not { Active: true, PlatformOperator: true, TwoFactorEnabled: true } || !AccountVerification.IsVerified(user) || context.HttpContext?.User.HasClaim("amr", "mfa") != true)
            throw new DomainException("operator_required", "A current platform billing/verification operator with MFA is required.", FailureKind.Forbidden);
    }
}
