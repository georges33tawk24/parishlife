// Purpose: hands a parish's control to its priest (owner decision, 23 November 2026). The parish priest controls the parish; the bishop, his
// archdiocese administrators or a ParishLife operator hand control over, and for a parish under an archdiocese only to a priest currently
// appointed to that parish. A parish without an archdiocese is handed over by an operator to any active verified account with an authenticator.
// In one parish transaction the new controller receives the setup-owner grant, the previous controller's grant is revoked (kept), and a pending
// payer transfer or association proposal made under the old control is withdrawn; every record, staff grant and appointment stays.
// Main function: HandOverAsync.

using Microsoft.AspNetCore.Identity;
using ParishLife.Api.Authorization;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Services.Organizations;

public class ParishControlService(IRecordTransactions records, IParishRepository parishes, ChurchAdministrationAuthority church, IStaffAppointmentAccess staff,
    MfaAccountAccess proof, UserManager<ParishUser> users, ICurrentActor actor, TimeProvider clock)
{
    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };

    public async Task<ParishDto> HandOverAsync(string parishId, HandOverParishControlDto request, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        var parish = await parishes.GetAsync(parishId, ct) ?? throw new DomainException("resource_not_found", "The requested resource is unavailable.", FailureKind.NotFound);
        await church.RequireAsync(parish.Value.JurisdictionArchdioceseId, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "parish-control:v1:" + parishId);
        if (await records.ReplayAsync<CommandResult>(Scope(parishId), op, ct) is not null)
            return ParishDto.From((await parishes.GetAsync(parishId, ct))!.Value);
        if (parish.Version != Versions.Require(request.Version))
            throw new DomainException("write_conflict", "The parish changed; reload it.", FailureKind.Conflict);
        if (parish.Value.Status == ParishStatus.Closed)
            throw new DomainException("parish_closed", "A closed parish's control is not handed over.", FailureKind.Conflict);
        var name = Guard.Text(request.Account, "Account", 254);
        var account = await users.FindByNameAsync(name) ?? await users.FindByEmailAsync(name);
        if (account is null || !await proof.IsVerifiedMfaAccountAsync(account.Id, ct))
            throw new DomainException("invalid_input", "Name the username or email of an active, verified account that signs in with an authenticator.");
        if (parish.Value.JurisdictionArchdioceseId is not null)
        {
            try { await staff.RequirePriestAsync(parishId, account.Id, ct); }
            catch (DomainException e) when (e.Kind is FailureKind.NotFound or FailureKind.Forbidden)
            {
                throw new DomainException("priest_required", "Control goes to a priest currently appointed to this parish; appoint him first.", FailureKind.Conflict);
            }
        }
        var prior = parish.Value.OwnerAccountId;
        if (prior == account.Id)
            throw new DomainException("already_in_control", "This account already controls the parish.", FailureKind.Conflict);

        var scope = Scope(parishId);
        parish.Value.OwnerAccountId = account.Id;
        var changes = new List<RecordChange> { RecordChange.Replace("parish", "parish", parish.Value, parish.Version) };
        if (await records.ReadAsync<AccessGrant>(scope, "grant:" + prior + ":local", ct) is { } priorGrant && !priorGrant.Value.Revoked)
        {
            priorGrant.Value.Revoked = true;
            changes.Add(RecordChange.Replace("grant:" + prior + ":local", "grant", priorGrant.Value, priorGrant.Version));
        }
        var grant = new AccessGrant
        {
            AccountId = account.Id, Allows = Permissions.SetupOwner.Order().ToArray(), Denies = [], StartsAt = op.At, EndsAt = null, Revoked = false, GrantedBy = actor.AccountId
        };
        var existing = await records.ReadAsync<AccessGrant>(scope, "grant:" + account.Id + ":local", ct);
        changes.Add(existing is null ? RecordChange.Create("grant:" + account.Id + ":local", "grant", grant)
            : RecordChange.Replace("grant:" + account.Id + ":local", "grant", grant, existing.Version));
        // Approvals given under the old control no longer represent the parish.
        if (await records.ReadAsync<CommandResult>(scope, "payerTransferPending", ct) is { } pending)
        {
            if (await records.ReadAsync<PayerTransfer>(scope, "payerTransfer:" + pending.Value.Id, ct) is { } transfer
                && transfer.Value.Status is "AwaitingParish" or "AwaitingArchdiocese")
            {
                transfer.Value.Status = "Cancelled";
                transfer.Value.DecidedBy = actor.AccountId;
                transfer.Value.DecidedAt = op.At;
                transfer.Value.DecisionReason = "Withdrawn when parish control was handed over.";
                changes.Add(RecordChange.Replace("payerTransfer:" + transfer.Value.Id, "payerTransfer", transfer.Value, transfer.Version));
            }
            changes.Add(RecordChange.Remove("payerTransferPending", pending.Version));
        }
        foreach (var association in await records.CollectAsync<AssociationRequest>(scope, "association", ct, 50,
                     new RecordCondition { Path = "status", Comparison = "eq", Value = "PendingArchdioceseApproval" }))
        {
            association.Value.Status = "WithdrawnByControlHandOver";
            changes.Add(RecordChange.Replace("association:" + association.Value.Id, "association", association.Value, association.Version));
        }
        await records.CommitAsync(scope, op, "parish.control_handed_over", parishId, changes, new CommandResult { Id = parishId, Status = "HandedOver" }, ct);
        return ParishDto.From(parish.Value);
    }
}
