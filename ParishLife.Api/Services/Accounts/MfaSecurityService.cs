// Purpose: stages and proves authenticator setup, issues protected one-use recovery codes, and atomically completes restricted recovery sign-in.
// Main functions: StatusAsync, BeginAsync, CompleteAsync, RegenerateAsync, RecoverLoginAsync; helpers bind proofs, receipts, and approvals to one account.

using Microsoft.AspNetCore.Identity;
using ParishLife.Api.DTOs.Accounts;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Accounts;

public class MfaSecurityService(IRecordTransactions records, MfaAccountAccess proof, MfaRecoveryService recovery,
    ParishUserManager users, IUserStore<ParishUser> store, AccountSessionService sessions, TimeProvider clock)
{
    private const string EnrollmentKey = "mfaEnrollment";

    public async Task<MfaSecurityStatusDto> StatusAsync(CancellationToken ct)
    {
        var user = await proof.CurrentAsync(ct);
        var pending = await records.ReadAsync<MfaEnrollment>(MfaRecoveryService.Scope(user.Id), EnrollmentKey, ct);
        return new MfaSecurityStatusDto
        {
            Enabled = user.TwoFactorEnabled,
            RecoveryCodesRemaining = await users.CountRecoveryCodesAsync(user),
            PendingEnrollmentExpiresAt = pending?.Value is { Status: "Pending" } value
                && value.SecurityStampAtStart == user.SecurityStamp && value.ExpiresAt > clock.GetUtcNow() ? value.ExpiresAt : null,
            RecoverySession = proof.RecoverySession
        };
    }

    public async Task<MfaEnrollmentDto> BeginAsync(BeginMfaEnrollmentDto request, CancellationToken ct)
    {
        var user = await proof.CurrentAsync(ct);
        await proof.PasswordAsync(user, request.CurrentPassword);
        var scope = MfaRecoveryService.Scope(user.Id);
        var id = Guard.Id(request.OperationId);
        var grant = await ReplacementProofAsync(user, request.CurrentCode, request.RecoveryRequestId?.ToString("N"), id, allowRebind: true, ct);
        var operation = Operation.Create(request.OperationId, user.Id,
            new { Kind = "mfa.begin", request.RecoveryRequestId }, clock); // Proofs never enter fingerprints, receipts, audit, or logs.
        var current = await records.ReadAsync<MfaEnrollment>(scope, EnrollmentKey, ct);
        if (await records.ReplayAsync<CommandResult>(scope, operation, ct) is not null)
            return await EnrollmentViewAsync(RequirePending(current, user, id));
        var candidate = new ParishUser { Id = user.Id };
        await proof.AuthenticatorStore.SetAuthenticatorKeyAsync(candidate, users.GenerateNewAuthenticatorKey(), ct);
        var pending = new MfaEnrollment
        {
            Id = id,
            AccountId = user.Id,
            SecurityStampAtStart = user.SecurityStamp!,
            ProtectedAuthenticatorKey = candidate.AuthenticatorKey!,
            CreatedAt = clock.GetUtcNow(),
            ExpiresAt = clock.GetUtcNow().AddMinutes(10),
            RecoveryRequestId = grant?.Value.Id
        };
        var changes = new List<RecordChange>
        {
            RecordChange.Replace("account", "account", user, user.PersistenceVersion!),
            current is null ? RecordChange.Create(EnrollmentKey, "mfaEnrollment", pending)
                : RecordChange.Replace(EnrollmentKey, "mfaEnrollment", pending, current.Version)
        };
        if (grant is not null)
        {
            grant.Value.BoundEnrollmentId = id;
            changes.Add(RecordChange.Replace(MfaRecoveryService.Key(grant.Value.Id), "mfaRecoveryRequest", grant.Value, grant.Version));
        }
        await records.CommitAsync(scope, operation, "identity.mfa_enrollment.started", id, changes,
            new CommandResult { Id = id, Status = "Pending" }, ct);
        // Concurrent duplicate commands must display the committed key, never a different locally generated candidate.
        return await EnrollmentViewAsync(RequirePending(await records.ReadAsync<MfaEnrollment>(scope, EnrollmentKey, ct), user, id));
    }

    public async Task<MfaRecoveryCodesDto> CompleteAsync(CompleteMfaEnrollmentDto request, CancellationToken ct)
    {
        var user = await proof.CurrentAsync(ct);
        await proof.PasswordAsync(user, request.CurrentPassword);
        var scope = MfaRecoveryService.Scope(user.Id);
        var id = Guard.Id(request.EnrollmentId);
        var operation = Operation.Create(request.OperationId, user.Id, new { Kind = "mfa.complete", EnrollmentId = id }, clock);
        await NotAlreadyAppliedAsync(scope, operation, ct);
        var row = await records.ReadAsync<MfaEnrollment>(scope, EnrollmentKey, ct);
        var pending = RequirePending(row, user, id);
        var grant = await ReplacementProofAsync(user, request.CurrentCode, pending.RecoveryRequestId, id, allowRebind: false, ct);
        var candidate = new ParishUser { Id = user.Id, AuthenticatorKey = pending.ProtectedAuthenticatorKey };
        if (!await proof.VerifyAsync(candidate, request.Code))
            await proof.FailAsync(user);
        var codes = users.CreateRecoveryCodes();
        user.AuthenticatorKey = pending.ProtectedAuthenticatorKey;
        user.TwoFactorEnabled = true;
        user.SecurityStamp = users.CreateSecurityStamp();
        user.AccessFailedCount = 0;
        await proof.RecoveryStore.ReplaceCodesAsync(user, codes, ct);
        pending.Status = "Completed";
        pending.ProtectedAuthenticatorKey = string.Empty;
        var changes = new List<RecordChange>
        {
            RecordChange.Replace("account", "account", user, user.PersistenceVersion!),
            RecordChange.Replace(EnrollmentKey, "mfaEnrollment", pending, row!.Version)
        };
        if (grant is not null)
        {
            grant.Value.Status = "Consumed";
            grant.Value.ConsumedAt = clock.GetUtcNow();
            changes.Add(RecordChange.Replace(MfaRecoveryService.Key(grant.Value.Id), "mfaRecoveryRequest", grant.Value, grant.Version));
        }
        await CommitCodesAsync(scope, operation, "identity.mfa_enrollment.completed", id, changes, ct);
        return new MfaRecoveryCodesDto { Enabled = true, RecoveryCodes = codes, RequiresSignIn = true };
    }

    public async Task<MfaRecoveryCodesDto> RegenerateAsync(RegenerateRecoveryCodesDto request, CancellationToken ct)
    {
        var user = await proof.CurrentAsync(ct);
        await proof.PasswordAsync(user, request.CurrentPassword);
        await proof.AuthenticatorAsync(user, request.CurrentCode);
        var scope = MfaRecoveryService.Scope(user.Id);
        var operation = Operation.Create(request.OperationId, user.Id, new { Kind = "mfa.codes.replace" }, clock);
        await NotAlreadyAppliedAsync(scope, operation, ct);
        var codes = users.CreateRecoveryCodes();
        await proof.RecoveryStore.ReplaceCodesAsync(user, codes, ct);
        user.SecurityStamp = users.CreateSecurityStamp();
        user.AccessFailedCount = 0;
        var changes = new List<RecordChange> { RecordChange.Replace("account", "account", user, user.PersistenceVersion!) };
        var pending = await records.ReadAsync<MfaEnrollment>(scope, EnrollmentKey, ct);
        if (pending?.Value.Status == "Pending")
        {
            pending.Value.Status = "Superseded";
            pending.Value.ProtectedAuthenticatorKey = string.Empty;
            changes.Add(RecordChange.Replace(EnrollmentKey, "mfaEnrollment", pending.Value, pending.Version));
        }
        await CommitCodesAsync(scope, operation, "identity.mfa_recovery_codes.replaced", user.Id, changes, ct);
        return new MfaRecoveryCodesDto { Enabled = true, RecoveryCodes = codes, RequiresSignIn = true };
    }

    public async Task<(ParishUser User, AccountSession Session)?> RecoverLoginAsync(CompleteRecoveryLoginDto request, CancellationToken ct)
    {
        var id = Guard.Id(request.AccountId);
        var user = await store.FindByIdAsync(id, ct);
        var challenge = await sessions.GetChallengeAsync(id, request.Challenge, ct);
        if (user is not { Active: true, TwoFactorEnabled: true } || !AccountVerification.IsVerified(user)
            || challenge is null || challenge.Value.AccountId != id || challenge.Value.Consumed
            || challenge.Value.SecurityStamp != user.SecurityStamp || challenge.Value.ExpiresAt <= clock.GetUtcNow()
            || await users.IsLockedOutAsync(user))
            return null;
        if (string.IsNullOrWhiteSpace(request.RecoveryCode) || request.RecoveryCode.Length > 32
            || !await proof.RecoveryStore.RedeemCodeAsync(user, request.RecoveryCode, ct))
        {
            _ = await users.AccessFailedAsync(user);
            return null;
        }
        user.AccessFailedCount = 0;
        // Code removal, challenge consumption, and the explicitly restricted session commit together.
        try
        { return (user, await sessions.CreateRecoveryAsync(user, challenge, ct)); }
        catch (DomainException error) when (error.Code is "write_conflict" or "challenge_invalid") { return null; }
    }

    private async Task<Versioned<MfaRecoveryRequest>?> ReplacementProofAsync(ParishUser user, string? code, string? recoveryId,
        string enrollmentId, bool allowRebind, CancellationToken ct)
    {
        if (!user.TwoFactorEnabled)
        {
            if (recoveryId is not null)
                throw InvalidEnrollment();
            return null;
        }
        if (recoveryId is not null)
            return await recovery.ApprovedAsync(user, recoveryId, enrollmentId, allowRebind, ct);
        if (string.IsNullOrWhiteSpace(code))
            throw new DomainException("authenticator_or_review_required", "Use your current authenticator or an independently approved recovery request.", FailureKind.Forbidden);
        await proof.AuthenticatorAsync(user, code);
        return null;
    }

    private MfaEnrollment RequirePending(Versioned<MfaEnrollment>? row, ParishUser user, string id)
    {
        if (row is null || row.Value.Id != id || row.Value.AccountId != user.Id || row.Value.Status != "Pending"
            || row.Value.SecurityStampAtStart != user.SecurityStamp || row.Value.ExpiresAt <= clock.GetUtcNow())
            throw InvalidEnrollment();
        return row.Value;
    }

    private async Task<MfaEnrollmentDto> EnrollmentViewAsync(MfaEnrollment pending)
    {
        var secret = await users.GetAuthenticatorKeyAsync(new ParishUser { Id = pending.AccountId, AuthenticatorKey = pending.ProtectedAuthenticatorKey })
            ?? throw InvalidEnrollment();
        var user = await users.FindByIdAsync(pending.AccountId) ?? throw InvalidEnrollment();
        const string issuer = "ParishLife";
        return new MfaEnrollmentDto
        {
            EnrollmentId = pending.Id,
            SharedKey = secret,
            AuthenticatorUri = $"otpauth://totp/{Uri.EscapeDataString(issuer)}:{Uri.EscapeDataString(user.UserName ?? user.Id)}?secret={secret}&issuer={issuer}&digits=6",
            ExpiresAt = pending.ExpiresAt
        };
    }

    private async Task NotAlreadyAppliedAsync(RecordScope scope, Operation operation, CancellationToken ct)
    {
        if (await records.ReplayAsync<CommandResult>(scope, operation, ct) is not null)
            throw AlreadyApplied();
    }

    private async Task CommitCodesAsync(RecordScope scope, Operation operation, string action, string id,
        IReadOnlyList<RecordChange> changes, CancellationToken ct)
    {
        var issueId = Guid.NewGuid().ToString("N");
        var outcome = await records.CommitAsync(scope, operation, action, id, changes,
            new CommandResult { Id = issueId, Status = "Completed" }, ct);
        if (outcome.Id != issueId)
            throw AlreadyApplied();
    }

    private static DomainException AlreadyApplied() => new("mfa_operation_already_applied", "This security change was already applied. Codes are shown once; sign in and generate a new set if necessary.", FailureKind.Conflict);
    private static DomainException InvalidEnrollment() => new("mfa_enrollment_unavailable", "Restart setup: this enrollment is expired, superseded, completed, or belongs to credentials that have since changed.", FailureKind.Conflict);
}
