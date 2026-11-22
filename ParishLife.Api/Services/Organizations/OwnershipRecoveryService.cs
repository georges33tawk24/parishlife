// Purpose: contested parish ownership and administration recovery (SUB12). A verified MFA account opens a restricted claim with minimal
// evidence; the current controlling owner is told in-app that a review exists and may respond; the bishop of the parish's confirmed archdiocese
// confirms or disputes the claim; a current MFA platform recovery operator who is neither party decides, and recovers administration only
// after the church confirmed (rejection needs no confirmation) - owner decision, 23 November 2026. Recovery moves only the controlling owner and owner grant in one parish transaction: the prior owner grant is
// revoked (kept), the claimant receives the ordinary setup-owner grant (no clergy office or signing authority), pending payer transfers and
// association proposals approved under the old control are withdrawn, and every parish record, staff grant, appointment and billing record stays.
// A claim decided after control already changed is refused, so concurrent claims cannot install competing owners. While any claim is open
// the parish is marked OwnershipContested and parish access refuses every change (reads stay); the mark clears when the last open claim ends.
// Main functions: OpenAsync, GetAsync, ListAsync, RespondAsync, WithdrawAsync, ConfirmAsync, DecideAsync; helpers ReviewerAsync, BishopAsync,
// OwnerAsync, ReadAsync and StillContestedAsync.

using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;
using ParishLife.Api.Services.Communications;

namespace ParishLife.Api.Services.Organizations;

public class OwnershipRecoveryService(IRecordTransactions records, IParishRepository parishes, IPlatformAccess platform, MfaAccountAccess proof,
    ICurrentActor actor, NotificationService notifications, IArchdioceseAuthority archdioceses, TimeProvider clock)
{
    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    private static string Marker(string account) => "ownershipClaimOpen:" + account;
    private static DomainException Missing() => new("resource_not_found", "The requested resource is unavailable.", FailureKind.NotFound);
    private static DomainException State(string message) => new("invalid_claim_state", message, FailureKind.Conflict);

    private void Personal()
    {
        if (actor.ActingAppointmentId is not null)
            throw new DomainException("personal_capacity_required", "Clear the appointment selection for this personal action.", FailureKind.Forbidden);
    }

    private async Task<Versioned<Parish>> ParishAsync(string parishId, CancellationToken ct) => await parishes.GetAsync(parishId, ct) ?? throw Missing();

    private async Task<Versioned<OwnershipClaim>> ReadAsync(string parishId, string id, CancellationToken ct)
        => await records.ReadAsync<OwnershipClaim>(Scope(parishId), "ownershipClaim:" + id, ct) is { } row && row.Value.ParishId == parishId ? row : throw Missing();

    // Non-reviewers learn nothing about whether a claim exists.
    private async Task<bool> ReviewerAsync(CancellationToken ct)
    {
        try { await platform.RequireOperatorAsync(ct); return true; }
        catch (DomainException e) when (e.Kind == FailureKind.Forbidden) { return false; }
    }

    // The bishop of the parish's confirmed archdiocese; others learn nothing.
    private async Task<bool> BishopAsync(Parish parish, CancellationToken ct)
    {
        if (parish.JurisdictionArchdioceseId is not { } archdiocese)
            return false;
        try { await archdioceses.RequireBishopAsync(archdiocese, ct); return true; }
        catch (DomainException e) when (e.Kind is FailureKind.Forbidden or FailureKind.NotFound) { return false; }
    }

    // True when another claim than the one ending is still open, so the parish stays read-only.
    private async Task<bool> StillContestedAsync(string parishId, string endingId, CancellationToken ct)
        => (await records.CollectAsync<OwnershipClaim>(Scope(parishId), "ownershipClaim", ct, 200,
            new RecordCondition { Path = "status", Comparison = "eq", Value = "Open" })).Any(c => c.Value.Id != endingId);

    private async Task<Versioned<Parish>> OwnerAsync(string parishId, CancellationToken ct)
    {
        Personal();
        await proof.RequireMfaAsync(ct);
        var parish = await ParishAsync(parishId, ct);
        return parish.Value.OwnerAccountId == actor.AccountId ? parish : throw Missing();
    }

    public async Task<OwnershipClaimDto> OpenAsync(string parishId, OpenOwnershipClaimDto request, CancellationToken ct)
    {
        Personal();
        await proof.RequireMfaAsync(ct);
        var parish = await ParishAsync(parishId, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "ownership-claim:v1:" + parishId);
        if (await records.ReplayAsync<CommandResult>(Scope(parishId), op, ct) is { } prior)
            return OwnershipClaimDto.ForClaimant((await ReadAsync(parishId, prior.Id, ct)).Value);
        if (parish.Value.Status == ParishStatus.Closed)
            throw new DomainException("parish_closed", "A closed parish's administration is not recovered here.", FailureKind.Conflict);
        if (parish.Value.OwnerAccountId == actor.AccountId)
            throw State("You already control this parish.");
        if (await records.ReadAsync<CommandResult>(Scope(parishId), Marker(actor.AccountId), ct) is not null)
            throw new DomainException("claim_already_open", "You already have an open claim for this parish.", FailureKind.Conflict);
        var claim = new OwnershipClaim
        {
            Id = op.Id, ParishId = parishId, ClaimantAccountId = actor.AccountId, OwnerAtOpening = parish.Value.OwnerAccountId,
            Statement = Guard.Text(request.Statement, "Statement", 2000), EvidenceReference = Guard.Text(request.EvidenceReference, "Evidence", 500),
            Status = "Open", OpenedAt = op.At
        };
        // The owner notice is generic: it names neither the claimant nor the evidence.
        var notice = notifications.StageRequired(parishId, parish.Value.OwnerAccountId, "parish.ownership_claim", "An ownership review was opened for your parish.",
            null, "ownership-claim:" + op.Id, "ParishOwner", parishId, op.At);
        var changes = new List<RecordChange>
        {
            RecordChange.Create("ownershipClaim:" + op.Id, "ownershipClaim", claim),
            RecordChange.Create(Marker(actor.AccountId), "ownershipClaimOpen", new CommandResult { Id = op.Id, Status = "Open" }), notice
        };
        // The parish becomes read-only in the same commit that opens the claim.
        if (!parish.Value.OwnershipContested)
        {
            parish.Value.OwnershipContested = true;
            changes.Add(RecordChange.Replace("parish", "parish", parish.Value, parish.Version));
        }
        await records.CommitAsync(Scope(parishId), op, "parish.ownership_claim_open", op.Id, changes, new CommandResult { Id = op.Id, Status = "Open" }, ct);
        await notifications.DispatchAsync(parishId, parish.Value.OwnerAccountId, "ownership-claim:" + op.Id, ct);
        return OwnershipClaimDto.ForClaimant(claim);
    }

    public async Task<Versioned<OwnershipClaimDto>> GetAsync(string parishId, string id, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        var row = await ReadAsync(parishId, id, ct);
        OwnershipClaimDto view;
        if (actor.ActingAppointmentId is null && row.Value.ClaimantAccountId == actor.AccountId)
            view = OwnershipClaimDto.ForClaimant(row.Value);
        else if (actor.ActingAppointmentId is null && (await ParishAsync(parishId, ct)).Value.OwnerAccountId == actor.AccountId)
            view = OwnershipClaimDto.ForOwner(row.Value);
        else if (await ReviewerAsync(ct) || await BishopAsync((await ParishAsync(parishId, ct)).Value, ct))
            view = OwnershipClaimDto.ForReviewer(row.Value);
        else
            throw Missing();
        return new Versioned<OwnershipClaimDto> { Value = view, Version = row.Version };
    }

    public async Task<Page<OwnershipClaimDto>> ListAsync(string parishId, int size, string? cursor, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        Func<OwnershipClaim, OwnershipClaimDto> project;
        var parish = (await ParishAsync(parishId, ct)).Value;
        if (actor.ActingAppointmentId is null && parish.OwnerAccountId == actor.AccountId)
            project = OwnershipClaimDto.ForOwner;
        else if (await ReviewerAsync(ct) || await BishopAsync(parish, ct))
            project = OwnershipClaimDto.ForReviewer;
        else
            throw Missing();
        var page = await records.PageAsync<OwnershipClaim>(Scope(parishId), "ownershipClaim", size, cursor, ct);
        return new Page<OwnershipClaimDto> { Items = page.Items.Select(r => project(r.Value)).OrderByDescending(c => c.OpenedAt).ToArray(), ContinuationToken = page.ContinuationToken };
    }

    public async Task<OwnershipClaimDto> RespondAsync(string parishId, string id, RespondOwnershipClaimDto request, CancellationToken ct)
    {
        await OwnerAsync(parishId, ct);
        var row = await ReadAsync(parishId, id, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "ownership-claim-response:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parishId), op, ct) is not null)
            return OwnershipClaimDto.ForOwner((await ReadAsync(parishId, id, ct)).Value);
        if (row.Value.Status != "Open")
            throw State("Only an open claim can receive a response.");
        row.Value.OwnerResponse = Guard.Text(request.Response, "Response", 2000);
        row.Value.OwnerRespondedAt = op.At;
        await records.CommitAsync(Scope(parishId), op, "parish.ownership_claim_response", id,
            [RecordChange.Replace("ownershipClaim:" + id, "ownershipClaim", row.Value, Versions.Require(request.Version))], new CommandResult { Id = id, Status = "Open" }, ct);
        return OwnershipClaimDto.ForOwner(row.Value);
    }

    public async Task<OwnershipClaimDto> WithdrawAsync(string parishId, string id, WithdrawOwnershipClaimDto request, CancellationToken ct)
    {
        Personal();
        await proof.RequireMfaAsync(ct);
        var row = await ReadAsync(parishId, id, ct);
        if (row.Value.ClaimantAccountId != actor.AccountId)
            throw Missing();
        var op = actor.CreateOperation(request.OperationId, request, clock, "ownership-claim-withdraw:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parishId), op, ct) is not null)
            return OwnershipClaimDto.ForClaimant((await ReadAsync(parishId, id, ct)).Value);
        if (row.Value.Status != "Open")
            throw State("Only an open claim can be withdrawn.");
        row.Value.Status = "Withdrawn";
        row.Value.DecidedAt = op.At;
        var changes = new List<RecordChange> { RecordChange.Replace("ownershipClaim:" + id, "ownershipClaim", row.Value, Versions.Require(request.Version)) };
        if (await records.ReadAsync<CommandResult>(Scope(parishId), Marker(actor.AccountId), ct) is { } marker && marker.Value.Id == id)
            changes.Add(RecordChange.Remove(Marker(actor.AccountId), marker.Version));
        var parish = await ParishAsync(parishId, ct);
        if (parish.Value.OwnershipContested && !await StillContestedAsync(parishId, id, ct))
        {
            parish.Value.OwnershipContested = false;
            changes.Add(RecordChange.Replace("parish", "parish", parish.Value, parish.Version));
        }
        await records.CommitAsync(Scope(parishId), op, "parish.ownership_claim_withdraw", id, changes, new CommandResult { Id = id, Status = "Withdrawn" }, ct);
        return OwnershipClaimDto.ForClaimant(row.Value);
    }

    // The bishop of the parish's confirmed archdiocese, independent of both parties, confirms or disputes an open claim. A later answer
    // replaces an earlier one while the claim is open.
    public async Task<OwnershipClaimDto> ConfirmAsync(string parishId, string id, ConfirmOwnershipClaimDto request, CancellationToken ct)
    {
        var parish = await ParishAsync(parishId, ct);
        if (parish.Value.JurisdictionArchdioceseId is not { } archdiocese)
            throw Missing();
        await archdioceses.RequireBishopAsync(archdiocese, ct);
        var row = await ReadAsync(parishId, id, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "ownership-claim-confirmation:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parishId), op, ct) is not null)
            return OwnershipClaimDto.ForReviewer((await ReadAsync(parishId, id, ct)).Value);
        if (request.Confirmed is null)
            throw new DomainException("invalid_input", "State explicitly whether the church confirms the claim.");
        if (row.Value.Status != "Open")
            throw State("Only an open claim can be confirmed or disputed.");
        if (actor.AccountId == row.Value.ClaimantAccountId || actor.AccountId == parish.Value.OwnerAccountId)
            throw new DomainException("independent_review_required", "A party to the claim cannot confirm it.", FailureKind.Forbidden);
        row.Value.ChurchConfirmation = request.Confirmed == true ? "Confirmed" : "Disputed";
        row.Value.ChurchConfirmedBy = actor.AccountId;
        row.Value.ChurchConfirmedAt = op.At;
        row.Value.ChurchNote = Guard.Text(request.Note, "Note", 1000);
        await records.CommitAsync(Scope(parishId), op, "parish.ownership_claim_church_" + row.Value.ChurchConfirmation.ToLowerInvariant(), id,
            [RecordChange.Replace("ownershipClaim:" + id, "ownershipClaim", row.Value, Versions.Require(request.Version))], new CommandResult { Id = id, Status = "Open" }, ct);
        return OwnershipClaimDto.ForReviewer(row.Value);
    }

    // Owner decision (23 November 2026): one current platform recovery operator, independent of both parties, decides with a recorded evidence
    // reference; administration is recovered only after the archdiocese bishop confirmed the claim. A rejection needs no confirmation.
    public async Task<OwnershipClaimDto> DecideAsync(string parishId, string id, DecideOwnershipClaimDto request, CancellationToken ct)
    {
        await platform.RequireOperatorAsync(ct);
        await proof.RequireMfaAsync(ct);
        var row = await ReadAsync(parishId, id, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "ownership-claim-decision:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parishId), op, ct) is not null)
            return OwnershipClaimDto.ForReviewer((await ReadAsync(parishId, id, ct)).Value);
        if (request.Recover is null)
            throw new DomainException("invalid_input", "State explicitly whether administration is recovered.");
        if (row.Version != Versions.Require(request.Version))
            throw new DomainException("write_conflict", "The claim changed after it was reviewed; reload it.", FailureKind.Conflict);
        var claim = row.Value;
        if (claim.Status != "Open")
            throw State("Only an open claim can be decided.");
        var parish = await ParishAsync(parishId, ct);
        if (actor.AccountId == claim.ClaimantAccountId || actor.AccountId == parish.Value.OwnerAccountId)
            throw new DomainException("independent_review_required", "A party to the claim cannot decide it.", FailureKind.Forbidden);
        claim.DecidedBy = actor.AccountId;
        claim.DecidedAt = op.At;
        claim.DecisionReason = Guard.Text(request.Reason, "Reason", 1000);
        claim.ReviewEvidenceReference = Guard.Text(request.EvidenceReference, "Evidence", 500);
        var changes = new List<RecordChange>();
        if (request.Recover == false)
            claim.Status = "Rejected";
        else
        {
            if (parish.Value.Status == ParishStatus.Closed)
                throw new DomainException("parish_closed", "A closed parish's administration is not recovered here.", FailureKind.Conflict);
            if (claim.ChurchConfirmation != "Confirmed")
                throw new DomainException("church_confirmation_required", "The parish's archdiocese must confirm this claim before administration is recovered.", FailureKind.Conflict);
            if (parish.Value.OwnerAccountId != claim.OwnerAtOpening)
                throw new DomainException("owner_changed", "Control changed after this claim was opened; it must be reopened against the current owner.", FailureKind.Conflict);
            if (!await proof.IsVerifiedMfaAccountAsync(claim.ClaimantAccountId, ct))
                throw new DomainException("account_unavailable", "The claimant must be an active verified account with an authenticator.", FailureKind.Conflict);
            var scope = Scope(parishId);
            var reconciled = new List<string>();
            var priorOwner = parish.Value.OwnerAccountId;
            parish.Value.OwnerAccountId = claim.ClaimantAccountId;
            parish.Value.OwnershipContested = await StillContestedAsync(parishId, id, ct);
            changes.Add(RecordChange.Replace("parish", "parish", parish.Value, parish.Version));
            if (await records.ReadAsync<AccessGrant>(scope, "grant:" + priorOwner + ":local", ct) is { } priorGrant && !priorGrant.Value.Revoked)
            {
                priorGrant.Value.Revoked = true;
                changes.Add(RecordChange.Replace("grant:" + priorOwner + ":local", "grant", priorGrant.Value, priorGrant.Version));
                reconciled.Add("grant:" + priorOwner + ":local revoked");
            }
            var ownerGrant = new AccessGrant
            {
                AccountId = claim.ClaimantAccountId, Allows = Permissions.SetupOwner.Order().ToArray(), Denies = [], StartsAt = op.At, EndsAt = null,
                Revoked = false, GrantedBy = actor.AccountId
            };
            var claimantGrant = await records.ReadAsync<AccessGrant>(scope, "grant:" + claim.ClaimantAccountId + ":local", ct);
            changes.Add(claimantGrant is null ? RecordChange.Create("grant:" + claim.ClaimantAccountId + ":local", "grant", ownerGrant)
                : RecordChange.Replace("grant:" + claim.ClaimantAccountId + ":local", "grant", ownerGrant, claimantGrant.Version));
            // Approvals given under the old control no longer represent the parish.
            if (await records.ReadAsync<CommandResult>(scope, "payerTransferPending", ct) is { } pending)
            {
                if (await records.ReadAsync<PayerTransfer>(scope, "payerTransfer:" + pending.Value.Id, ct) is { } transfer
                    && transfer.Value.Status is "AwaitingParish" or "AwaitingArchdiocese")
                {
                    transfer.Value.Status = "Cancelled";
                    transfer.Value.DecidedBy = actor.AccountId;
                    transfer.Value.DecidedAt = op.At;
                    transfer.Value.DecisionReason = "Withdrawn by parish ownership recovery.";
                    changes.Add(RecordChange.Replace("payerTransfer:" + transfer.Value.Id, "payerTransfer", transfer.Value, transfer.Version));
                    reconciled.Add("payerTransfer:" + transfer.Value.Id + " cancelled");
                }
                changes.Add(RecordChange.Remove("payerTransferPending", pending.Version));
            }
            foreach (var association in await records.CollectAsync<AssociationRequest>(scope, "association", ct, 50,
                         new RecordCondition { Path = "status", Comparison = "eq", Value = "PendingArchdioceseApproval" }))
            {
                association.Value.Status = "WithdrawnByOwnershipRecovery";
                changes.Add(RecordChange.Replace("association:" + association.Value.Id, "association", association.Value, association.Version));
                reconciled.Add("association:" + association.Value.Id + " withdrawn");
            }
            claim.Status = "Recovered";
            claim.PreviousOwnerAccountId = priorOwner;
            claim.ReconciledRecords = [.. reconciled];
        }
        if (request.Recover == false && parish.Value.OwnershipContested && !await StillContestedAsync(parishId, id, ct))
        {
            parish.Value.OwnershipContested = false;
            changes.Add(RecordChange.Replace("parish", "parish", parish.Value, parish.Version));
        }
        changes.Add(RecordChange.Replace("ownershipClaim:" + id, "ownershipClaim", claim, row.Version));
        if (await records.ReadAsync<CommandResult>(Scope(parishId), Marker(claim.ClaimantAccountId), ct) is { } marker && marker.Value.Id == id)
            changes.Add(RecordChange.Remove(Marker(claim.ClaimantAccountId), marker.Version));
        await records.CommitAsync(Scope(parishId), op, "parish.ownership_claim_" + claim.Status.ToLowerInvariant(), id, changes, new CommandResult { Id = id, Status = claim.Status }, ct, claim.DecisionReason);
        return OwnershipClaimDto.ForReviewer(claim);
    }
}
