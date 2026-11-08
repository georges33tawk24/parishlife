// Purpose: records factual parish jurisdiction through its representative proposal and actual bishop decision, independent of commercial association.
// Main functions: ProposeAsync, DecideAsync, GetAsync; conditional parish/proposal writes preserve existing grants, payer and coverage.

using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Services.Organizations;

public class ParishJurisdictionService(IRecordTransactions records, IParishRepository parishes, ICurrentActor actor,
    IArchdioceseAuthority bishops, MfaAccountAccess proof, TimeProvider clock)
{
    private static RecordScope Scope(string id) => new() { Area = RecordArea.Parish, OwnerId = id };
    private static string Key(string id) => "jurisdictionProposal:" + id;

    public async Task<ParishJurisdictionProposalDto> ProposeAsync(string parishId, ProposeParishJurisdictionDto request, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        var parish = await parishes.GetAsync(parishId, ct) ?? throw Missing();
        if (parish.Value.OwnerAccountId != actor.AccountId || actor.ActingAppointmentId is not null)
            throw Missing();
        var arch = Guard.Id(request.ArchdioceseId);
        if ((await parishes.GetArchdioceseAsync(arch, ct))?.Value.Verified != true)
            throw new DomainException("organization_unavailable", "Select a verified registered archdiocese.");
        var operation = actor.CreateOperation(request.OperationId, request, clock, "jurisdiction:" + parishId);
        if (await records.ReplayAsync<ParishJurisdictionProposal>(Scope(parishId), operation, ct) is { } prior)
            return View(prior);
        if (parish.Value.Status != ParishStatus.Verified || parish.Value.JurisdictionArchdioceseId is not null)
            throw new DomainException("jurisdiction_review_required", "Use verified representative setup for a first jurisdiction; reassignment requires its separate reviewed process.", FailureKind.Conflict);
        var value = new ParishJurisdictionProposal
        {
            Id = operation.Id,
            ParishId = parishId,
            ArchdioceseId = arch,
            ProposedBy = actor.AccountId,
            ProposedAt = clock.GetUtcNow(),
            Reason = Guard.Text(request.Reason, "Reason", 2000),
            EvidenceReference = Guard.Text(request.EvidenceReference, "Actual jurisdiction/adoption evidence", 500)
        };
        return View(await records.CommitAsync(Scope(parishId), operation, "jurisdiction.proposed", value.Id,
            [RecordChange.Replace("parish", "parish", parish.Value, Versions.Require(request.Version)),
             RecordChange.Create(Key(value.Id), "jurisdictionProposal", value)], value, ct, value.Reason));
    }

    public async Task<ParishJurisdictionProposalDto> DecideAsync(string parishId, string id, DecideParishJurisdictionDto request, CancellationToken ct)
    {
        if (request.Accept is null)
            throw new DomainException("decision_required", "Explicitly accept or decline the jurisdiction proposal.");
        var row = await ReadAsync(parishId, id, ct);
        var bishop = await bishops.RequireBishopAppointmentAsync(row.Value.ArchdioceseId, ct);
        var user = await proof.RequireMfaAsync(ct);
        await proof.PasswordAsync(user, request.CurrentPassword);
        await proof.AuthenticatorAsync(user, request.CurrentCode);
        var operation = Operation.Create(request.OperationId, actor.AccountId,
            new { Kind = "jurisdiction.decide", ParishId = parishId, ProposalId = id, request.Version, request.Accept, request.Reason },
            clock, actingAppointmentId: bishop.Value.Id);
        if (await records.ReplayAsync<ParishJurisdictionProposal>(Scope(parishId), operation, ct) is { } prior)
            return View(prior);
        var parish = await parishes.GetAsync(parishId, ct) ?? throw Missing();
        if (row.Value.Status != "Pending" || parish.Value.Status != ParishStatus.Verified || parish.Value.JurisdictionArchdioceseId is not null)
            throw new DomainException("jurisdiction_review_required", "This first-jurisdiction proposal can no longer be decided.", FailureKind.Conflict);
        var value = row.Value;
        value.Status = request.Accept.Value ? "Accepted" : "Declined";
        value.DecidedBy = actor.AccountId;
        value.DecidedAt = clock.GetUtcNow();
        value.DecisionReason = Guard.Text(request.Reason, "Decision reason", 2000);
        if (request.Accept.Value)
        {
            parish.Value.JurisdictionArchdioceseId = value.ArchdioceseId;
            parish.Value.JurisdictionProposalId = value.Id;
        }
        return View(await records.CommitAsync(Scope(parishId), operation, "jurisdiction.decided", id,
            [RecordChange.Replace("parish", "parish", parish.Value, parish.Version),
             RecordChange.Replace(Key(id), "jurisdictionProposal", value, Versions.Require(request.Version))], value, ct, value.DecisionReason));
    }

    public async Task<Versioned<ParishJurisdictionProposalDto>> GetAsync(string parishId, string id, CancellationToken ct)
    {
        var row = await ReadAsync(parishId, id, ct);
        var parish = await parishes.GetAsync(parishId, ct) ?? throw Missing();
        await proof.RequireMfaAsync(ct);
        if (parish.Value.OwnerAccountId != actor.AccountId)
        {
            try
            { await bishops.RequireBishopAsync(row.Value.ArchdioceseId, ct); }
            catch (DomainException error) when (error.Kind == FailureKind.Forbidden) { throw Missing(); }
        }
        return new Versioned<ParishJurisdictionProposalDto> { Value = View(row.Value), Version = row.Version };
    }

    private async Task<Versioned<ParishJurisdictionProposal>> ReadAsync(string parishId, string id, CancellationToken ct)
    {
        var row = await records.ReadAsync<ParishJurisdictionProposal>(Scope(parishId), Key(id), ct) ?? throw Missing();
        if (row.Value.Id != id || row.Value.ParishId != parishId)
            throw Missing();
        return row;
    }

    private static ParishJurisdictionProposalDto View(ParishJurisdictionProposal value) => new()
    {
        Id = value.Id,
        ParishId = value.ParishId,
        ArchdioceseId = value.ArchdioceseId,
        Status = value.Status,
        Reason = value.Reason,
        ProposedBy = value.ProposedBy,
        ProposedAt = value.ProposedAt,
        DecidedBy = value.DecidedBy,
        DecidedAt = value.DecidedAt,
        DecisionReason = value.DecisionReason,
        EvidenceReference = value.EvidenceReference
    };

    private static DomainException Missing() => new("jurisdiction_proposal_unavailable", "The jurisdiction proposal is unavailable.", FailureKind.NotFound);
}
