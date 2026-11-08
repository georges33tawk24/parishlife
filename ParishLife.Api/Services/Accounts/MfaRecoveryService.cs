// Purpose: records owner-requested lost-device recovery and another operator's identity-reviewed, time-limited reset approval.
// Main functions: RequestAsync, ReviewAsync, GetOwnAsync, GetForOperatorAsync, ApprovedAsync; target recovery changes share one partition, while reviewer authentication uses its own Identity state.

using ParishLife.Api.DTOs.Accounts;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Accounts;

public class MfaRecoveryService(IRecordTransactions records, MfaAccountAccess proof,
    IPlatformAccess platform, TimeProvider clock)
{
    internal static RecordScope Scope(string accountId) => new() { Area = RecordArea.Account, OwnerId = accountId };
    internal static string Key(string id) => "mfaRecovery:" + id;

    public async Task<MfaRecoveryRequestDto> RequestAsync(RequestMfaRecoveryDto request, CancellationToken ct)
    {
        var user = await proof.CurrentAsync(ct);
        if (!user.TwoFactorEnabled || !proof.RecoverySession)
            throw new DomainException("recovery_session_required", "Sign in with an unused recovery code before requesting a reviewed device reset.", FailureKind.Forbidden);
        await proof.PasswordAsync(user, request.CurrentPassword);
        var operation = Operation.Create(request.OperationId, user.Id,
            new { Kind = "mfa.recovery.request", request.Reason }, clock);
        var scope = Scope(user.Id);
        if (await records.ReplayAsync<CommandResult>(scope, operation, ct) is { } prior)
            return (await GetOwnAsync(prior.Id, ct)).Value;
        var recovery = new MfaRecoveryRequest
        {
            Id = operation.Id,
            AccountId = user.Id,
            SecurityStampAtRequest = user.SecurityStamp!,
            Reason = Guard.Text(request.Reason, "Recovery reason", 2000),
            CreatedAt = clock.GetUtcNow(),
            ExpiresAt = clock.GetUtcNow().AddHours(24)
        };
        await records.CommitAsync(scope, operation, "identity.mfa_recovery.requested", recovery.Id,
            [RecordChange.Replace("account", "account", user, user.PersistenceVersion!),
             RecordChange.Create(Key(recovery.Id), "mfaRecoveryRequest", recovery)],
            new CommandResult { Id = recovery.Id, Status = "Pending" }, ct);
        return View((await ReadAsync(user.Id, recovery.Id, ct)).Value);
    }

    public async Task<MfaRecoveryRequestDto> ReviewAsync(string accountId, string id, ReviewMfaRecoveryDto request, CancellationToken ct)
    {
        await platform.RequireOperatorAsync(ct);
        var reviewer = await proof.CurrentAsync(ct);
        if (reviewer.Id == accountId)
            throw new DomainException("independent_review_required", "Another active Super Admin must review your lost-device reset.", FailureKind.Forbidden);
        if (request.Approve is null)
            throw new DomainException("decision_required", "Explicitly approve or reject this recovery request.");
        await proof.PasswordAsync(reviewer, request.CurrentPassword);
        await proof.AuthenticatorAsync(reviewer, request.CurrentCode);
        var operation = Operation.Create(request.OperationId, reviewer.Id,
            new { Kind = "mfa.recovery.review", AccountId = accountId, RequestId = id, request.Approve, request.Reason, request.VerificationReference }, clock);
        var scope = Scope(accountId);
        if (await records.ReplayAsync<CommandResult>(scope, operation, ct) is not null)
            return View((await ReadAsync(accountId, id, ct)).Value, includeEvidence: true);
        var row = await ReadAsync(accountId, id, ct);
        var account = await records.ReadAsync<ParishUser>(scope, "account", ct) ?? throw Missing();
        var value = row.Value;
        if (value.Status != "Pending" || value.ExpiresAt <= clock.GetUtcNow()
            || account.Value is not { Active: true, TwoFactorEnabled: true } || !AccountVerification.IsVerified(account.Value)
            || account.Value.SecurityStamp != value.SecurityStampAtRequest)
            throw InvalidState();
        value.Status = request.Approve.Value ? "Approved" : "Rejected";
        value.ReviewedBy = reviewer.Id;
        value.ReviewedAt = clock.GetUtcNow();
        value.ReviewReason = Guard.Text(request.Reason, "Review reason", 2000);
        value.VerificationReference = Guard.Text(request.VerificationReference, "Actual identity review evidence", 500);
        value.ApprovalExpiresAt = request.Approve.Value ? clock.GetUtcNow().AddMinutes(30) : null;
        await records.CommitAsync(scope, operation, "identity.mfa_recovery.reviewed", id,
            [RecordChange.Replace("account", "account", account.Value, account.Version),
             RecordChange.Replace(Key(id), "mfaRecoveryRequest", value, Versions.Require(request.Version))],
            new CommandResult { Id = id, Status = value.Status }, ct, value.ReviewReason);
        return View((await ReadAsync(accountId, id, ct)).Value, includeEvidence: true);
    }

    public async Task<Versioned<MfaRecoveryRequestDto>> GetOwnAsync(string id, CancellationToken ct)
    {
        var user = await proof.CurrentAsync(ct);
        var row = await ReadAsync(user.Id, id, ct);
        return new Versioned<MfaRecoveryRequestDto> { Value = View(row.Value), Version = row.Version };
    }

    public async Task<Versioned<MfaRecoveryRequestDto>> GetForOperatorAsync(string accountId, string id, CancellationToken ct)
    {
        await platform.RequireOperatorAsync(ct);
        var row = await ReadAsync(accountId, id, ct);
        return new Versioned<MfaRecoveryRequestDto> { Value = View(row.Value, includeEvidence: true), Version = row.Version };
    }

    internal async Task<Versioned<MfaRecoveryRequest>> ApprovedAsync(ParishUser user, string id, string enrollmentId, bool allowRebind, CancellationToken ct)
    {
        if (!proof.RecoverySession)
            throw InvalidState();
        var row = await ReadAsync(user.Id, id, ct);
        var grant = row.Value;
        if (grant.Status != "Approved" || grant.SecurityStampAtRequest != user.SecurityStamp
            || grant.ApprovalExpiresAt is null || grant.ApprovalExpiresAt <= clock.GetUtcNow()
            || grant.ExpiresAt <= clock.GetUtcNow() || grant.ReviewedBy is null || grant.ReviewedBy == user.Id
            || string.IsNullOrWhiteSpace(grant.VerificationReference)
            || !allowRebind && grant.BoundEnrollmentId != enrollmentId
            || !await proof.IsEligibleOperatorAsync(grant.ReviewedBy, ct))
            throw InvalidState();
        return row;
    }

    private async Task<Versioned<MfaRecoveryRequest>> ReadAsync(string accountId, string id, CancellationToken ct)
    {
        var row = await records.ReadAsync<MfaRecoveryRequest>(Scope(accountId), Key(id), ct) ?? throw Missing();
        if (row.Value.AccountId != accountId || row.Value.Id != id)
            throw Missing();
        return row;
    }

    private static MfaRecoveryRequestDto View(MfaRecoveryRequest value, bool includeEvidence = false) => new()
    {
        Id = value.Id,
        AccountId = value.AccountId,
        Status = value.Status,
        Reason = value.Reason,
        CreatedAt = value.CreatedAt,
        ExpiresAt = value.ExpiresAt,
        ReviewedBy = value.ReviewedBy,
        ReviewedAt = value.ReviewedAt,
        ReviewReason = value.ReviewReason,
        ApprovalExpiresAt = value.ApprovalExpiresAt,
        ConsumedAt = value.ConsumedAt,
        VerificationReference = includeEvidence ? value.VerificationReference : null
    };

    private static DomainException Missing() => new("recovery_request_unavailable", "The recovery request is unavailable.", FailureKind.NotFound);
    private static DomainException InvalidState() => new("recovery_approval_required", "A current independent identity-reviewed approval is required for this device reset.", FailureKind.Forbidden);
}
