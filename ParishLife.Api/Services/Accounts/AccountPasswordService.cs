// Purpose: changes a personally authenticated account password through maintained Identity validation/hash/stamp primitives and one account transaction.
// Main functions: ChangeAsync enforces fresh proofs and conditional idempotent commit; ViewAsync reports the current safe outcome;
// CurrentPasswordMatches performs framework hash verification without rehashing or persisting during a read.

using Microsoft.AspNetCore.Identity;
using ParishLife.Api.DTOs.Accounts;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Accounts;

public class AccountPasswordService(IRecordTransactions records, MfaAccountAccess proof, ParishUserManager users,
    ICurrentActor actor, TimeProvider clock)
{
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
        bool replay, string requestedPassword, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();
        var current = await users.FindByIdAsync(account);
        if (current is not { Active: true } || !AccountVerification.IsVerified(current) || await users.IsLockedOutAsync(current))
            throw new DomainException("account_unavailable", "The current account is unavailable.", FailureKind.Forbidden);
        return new PasswordChangeResultDto
        {
            OperationId = operationId,
            Status = replay ? "AlreadyApplied" : "Changed",
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
