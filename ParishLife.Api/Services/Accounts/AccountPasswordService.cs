// Purpose: changes a personally authenticated account password through maintained Identity validation/hash/stamp primitives and one account transaction.
// Main functions: ChangeAsync enforces fresh proofs and conditional idempotent commit; AddAsync gives a passwordless account (made by
// provider sign-up) its first password, proven by a provider sign-in of this very session within FreshExternalSignIn; ViewAsync reports
// the current safe outcome; CurrentPasswordMatches performs framework hash verification without rehashing or persisting during a read.

using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using ParishLife.Api.DTOs.Accounts;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Accounts;

public class AccountPasswordService(IRecordTransactions records, MfaAccountAccess proof, ParishUserManager users,
    ICurrentActor actor, TimeProvider clock, AccountSessionService sessions, IHttpContextAccessor context)
{
    // How recent the provider sign-in must be to stand in for the current password an account without one cannot give.
    public static readonly TimeSpan FreshExternalSignIn = TimeSpan.FromMinutes(10);

    public async Task<PasswordChangeResultDto> AddAsync(AddAccountPasswordDto request, CancellationToken ct)
    {
        if (actor.ActingAppointmentId is not null || proof.RecoverySession)
            throw new DomainException("personal_password_capacity_required", "Use a normal personal sign-in before adding a password.", FailureKind.Forbidden);
        var user = await proof.CurrentAsync(ct);
        if (await users.IsLockedOutAsync(user))
            throw new DomainException("account_unavailable", "The current account is unavailable.", FailureKind.Forbidden);
        var scope = MfaRecoveryService.Scope(user.Id);
        // The password, its hash and the session never enter the command fingerprint or receipt.
        var operation = Operation.Create(request.OperationId, user.Id, new { Kind = "account.password.add" }, clock, "account-password:v1");
        // An account that already has a password says so first, unless this is a retry of the add that gave it one.
        if (user.PasswordHash is not null && await records.ReplayAsync<PasswordCommit>(scope, operation, ct) is null)
            throw new DomainException("password_exists", "This account already has a password. Change it instead.", FailureKind.Conflict);
        // The proof: this session itself came from a provider sign-in a few minutes ago (sign out and sign in again otherwise).
        var sid = context.HttpContext?.User.FindFirstValue("sid");
        var session = sid is null ? null : await sessions.FindValidAsync(user.Id, sid, user.SecurityStamp!, ct);
        if (session is not { AuthenticationMethod: "external" } || session.CreatedAt < clock.GetUtcNow() - FreshExternalSignIn)
            throw new DomainException("fresh_external_sign_in_required",
                "Sign out, sign in again with Google or Microsoft, then add the password within 10 minutes.", FailureKind.Forbidden);
        if (user.TwoFactorEnabled || user.PlatformOperator)
        {
            user = await proof.RequireMfaAsync(ct);
            await proof.AuthenticatorAsync(user, request.CurrentCode);
        }
        if (await records.ReplayAsync<PasswordCommit>(scope, operation, ct) is { } prior)
            return await ViewAsync(user.Id, operation.Id, prior, true, request.NewPassword, ct, "Added");
        if (request.NewPassword is null || request.NewPassword.Length is < 16 or > 200)
            throw new DomainException("invalid_password", "New password must contain 16–200 characters.");
        var staged = await users.StagePasswordAsync(user, request.NewPassword);
        BreachedPasswordValidator.ThrowIfBreached(staged);
        if (!staged.Succeeded)
            throw new DomainException("new_password_rejected", "The proposed password does not satisfy the configured password policy.");
        user.AccessFailedCount = 0;
        // The new security stamp ends every session, this one included: the next sign-in may use the password or the provider.
        var candidate = new PasswordCommit { CommitId = Guid.NewGuid().ToString("N"), ChangedAt = operation.At };
        var result = await records.CommitAsync(scope, operation, "identity.password_added", user.Id,
            [RecordChange.Replace("account", "account", user, user.PersistenceVersion!)], candidate, ct);
        return await ViewAsync(user.Id, operation.Id, result, result.CommitId != candidate.CommitId, request.NewPassword, ct, "Added");
    }

    public async Task<PasswordChangeResultDto> ChangeAsync(ChangeAccountPasswordDto request, CancellationToken ct)
    {
        if (actor.ActingAppointmentId is not null || proof.RecoverySession)
            throw new DomainException("personal_password_capacity_required", "Use a normal personal sign-in before changing your password.", FailureKind.Forbidden);
        var user = await proof.CurrentAsync(ct);
        if (await users.IsLockedOutAsync(user))
            throw new DomainException("account_unavailable", "The current account is unavailable.", FailureKind.Forbidden);
        if (user.TwoFactorEnabled || user.PlatformOperator)
        {
            user = await proof.RequireMfaAsync(ct);
            await proof.PasswordAsync(user, request.CurrentPassword);
            await proof.AuthenticatorAsync(user, request.CurrentCode);
        }
        else
            await proof.PasswordAsync(user, request.CurrentPassword);

        if (request.NewPassword is null || request.NewPassword.Length is < 16 or > 200)
            throw new DomainException("invalid_password", "New password must contain 16–200 characters.");
        var scope = MfaRecoveryService.Scope(user.Id);
        // A password, its hash, TOTP and security stamp never enter the command fingerprint or receipt.
        var operation = Operation.Create(request.OperationId, user.Id, new { Kind = "account.password.change" }, clock, "account-password:v1");
        if (await records.ReplayAsync<PasswordCommit>(scope, operation, ct) is { } prior)
            return await ViewAsync(user.Id, operation.Id, prior, true, request.NewPassword, ct);
        if (CurrentPasswordMatches(user, request.NewPassword))
            throw new DomainException("password_unchanged", "Choose a password different from the current password.");

        var staged = await users.StagePasswordAsync(user, request.NewPassword);
        BreachedPasswordValidator.ThrowIfBreached(staged);
        if (!staged.Succeeded)
            throw new DomainException("new_password_rejected", "The proposed password does not satisfy the configured password policy.");
        user.AccessFailedCount = 0;
        var changes = new List<RecordChange> { RecordChange.Replace("account", "account", user, user.PersistenceVersion!) };
        var enrollment = await records.ReadAsync<MfaEnrollment>(scope, "mfaEnrollment", ct);
        if (enrollment?.Value.Status == "Pending")
        {
            enrollment.Value.Status = "Superseded";
            enrollment.Value.ProtectedAuthenticatorKey = string.Empty;
            changes.Add(RecordChange.Replace("mfaEnrollment", "mfaEnrollment", enrollment.Value, enrollment.Version));
        }
        // Existing sessions/challenges/reviewed recovery are bound to the old security stamp and become invalid together.
        var candidate = new PasswordCommit { CommitId = Guid.NewGuid().ToString("N"), ChangedAt = operation.At };
        var result = await records.CommitAsync(scope, operation, "identity.password_changed", user.Id, changes, candidate, ct);
        return await ViewAsync(user.Id, operation.Id, result, result.CommitId != candidate.CommitId, request.NewPassword, ct);
    }

    private async Task<PasswordChangeResultDto> ViewAsync(string account, string operationId, PasswordCommit outcome,
        bool replay, string requestedPassword, CancellationToken ct, string applied = "Changed")
    {
        ct.ThrowIfCancellationRequested();
        var current = await users.FindByIdAsync(account);
        if (current is not { Active: true } || !AccountVerification.IsVerified(current) || await users.IsLockedOutAsync(current))
            throw new DomainException("account_unavailable", "The current account is unavailable.", FailureKind.Forbidden);
        return new PasswordChangeResultDto
        {
            OperationId = operationId,
            Status = replay ? "AlreadyApplied" : applied,
            ChangedAt = outcome.ChangedAt,
            RequestedPasswordIsCurrent = CurrentPasswordMatches(current, requestedPassword),
            PriorSessionsInvalidated = true,
            RequiresSignIn = true
        };
    }

    private bool CurrentPasswordMatches(ParishUser user, string password) => user.PasswordHash is { } hash
        && users.PasswordHasher.VerifyHashedPassword(user, hash, password) != PasswordVerificationResult.Failed;

    private sealed class PasswordCommit
    {
        public string CommitId { get; set; } = string.Empty;
        public DateTimeOffset ChangedAt { get; set; }
    }
}
