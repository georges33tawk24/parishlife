// Purpose: records a factual first-bishop appointment through two separate operators and the nominee's explicit response.
// Main functions: ProposeAsync, ReviewAsync, DecideAsync, GetAsync; private helpers enforce exact partition, dates, identity, and atomic fences.

using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Organizations;

public class BishopAppointmentService(IRecordTransactions records, IParishRepository organizations,
    IAccountDirectory accounts, ICurrentActor actor, IPlatformAccess platform, TimeProvider clock)
{
    private static RecordScope Scope(string id) => new() { Area = RecordArea.Archdiocese, OwnerId = id };
    private static string Key(string id) => "bishopAppointment:" + id;
    private static DomainException Missing() => new("appointment_unavailable", "The requested appointment is unavailable.", FailureKind.NotFound);
    private static DomainException State(string message) => new("invalid_appointment_state", message, FailureKind.Conflict);

    public async Task<BishopAppointment> ProposeAsync(string archdioceseId, ProposeBishopAppointmentDto request, CancellationToken ct)
    {
        await platform.RequireOperatorAsync(ct);
        var scope = Scope(archdioceseId);
        var operation = actor.CreateOperation(request.OperationId, request, clock, "first-bishop:" + archdioceseId);
        if (await records.ReplayAsync<BishopAppointment>(scope, operation, ct) is { } prior)
            return prior;
        var organization = await VerifiedOrganization(archdioceseId, ct);
        await UnoccupiedSeat(scope, ct);
        var account = Guard.Id(request.AccountId);
        if (account == actor.AccountId || !await accounts.IsActiveVerifiedAsync(account, ct))
            throw new DomainException("nominee_unavailable", "Use another existing, active, verified nominee account.");
        var now = clock.GetUtcNow();
        Guard.Utc(request.StartsAt);
        Guard.Utc(request.AcceptBy);
        if (request.AcceptBy <= now || request.EndsAt is { } end && (Guard.Utc(end) <= request.StartsAt || end <= request.AcceptBy)
            || request.ReviewDueAt is { } review && (Guard.Utc(review) <= request.StartsAt || request.EndsAt is { } last && review >= last))
            throw new DomainException("invalid_appointment_dates", "Use a future acceptance deadline, a valid effective period, and an optional review date within that period.");
        var appointment = new BishopAppointment
        {
            Id = operation.Id,
            ArchdioceseId = archdioceseId,
            AccountId = account,
            StartsAt = request.StartsAt,
            EndsAt = request.EndsAt,
            AcceptBy = request.AcceptBy,
            ReviewDueAt = request.ReviewDueAt,
            EvidenceReference = Guard.Text(request.EvidenceReference, "Actual appointment evidence", 500),
            Reason = Guard.Text(request.Reason, "Appointment reason", 2000),
            ProposedBy = actor.AccountId,
            ProposedAt = now
        };
        return await records.CommitAsync(scope, operation, "bishop_appointment.proposed", appointment.Id,
            [RecordChange.Replace("organization", "organization", organization.Value, Versions.Require(request.OrganizationVersion)),
             RecordChange.Create(Key(appointment.Id), "bishopAppointment", appointment)], appointment, ct, appointment.Reason);
    }

    public async Task<BishopAppointment> ReviewAsync(string archdioceseId, string id, ReviewBishopAppointmentDto request, CancellationToken ct)
    {
        await platform.RequireOperatorAsync(ct);
        if (request.Approve is null)
            throw new DomainException("decision_required", "Explicitly approve or reject this proposal.");
        var scope = Scope(archdioceseId);
        var operation = actor.CreateOperation(request.OperationId, request, clock, "bishop-review:" + archdioceseId + ":" + id);
        if (await records.ReplayAsync<BishopAppointment>(scope, operation, ct) is { } prior)
            return prior;
        var organization = await VerifiedOrganization(archdioceseId, ct);
        var row = await Read(archdioceseId, id, ct);
        var appointment = row.Value;
        if (actor.AccountId == appointment.ProposedBy || actor.AccountId == appointment.AccountId)
            throw new DomainException("independent_review_required", "A different active Super Admin must review this administrative appointment.", FailureKind.Forbidden);
        if (appointment.Status != "PendingReview" || appointment.AcceptBy <= clock.GetUtcNow())
            throw State("Only an unexpired pending proposal can be reviewed.");
        await UnoccupiedSeat(scope, ct);
        if (!await accounts.IsActiveVerifiedAsync(appointment.AccountId, ct))
            throw new DomainException("nominee_unavailable", "The nominee must remain active and verified.");
        appointment.Status = request.Approve.Value ? "Invited" : "Rejected";
        appointment.ReviewedBy = actor.AccountId;
        appointment.ReviewedAt = clock.GetUtcNow();
        appointment.ReviewReason = Guard.Text(request.Reason, "Review reason", 2000);
        return await records.CommitAsync(scope, operation, "bishop_appointment.reviewed", id,
            [RecordChange.Replace("organization", "organization", organization.Value, organization.Version),
             RecordChange.Replace(Key(id), "bishopAppointment", appointment, Versions.Require(request.Version))], appointment, ct, appointment.ReviewReason);
    }

    public async Task<BishopAppointment> DecideAsync(string archdioceseId, string id, DecideBishopInvitationDto request, CancellationToken ct)
    {
        if (request.Accept is null)
            throw new DomainException("decision_required", "Explicitly accept or decline this invitation.");
        var row = await Read(archdioceseId, id, ct);
        if (row.Value.AccountId != actor.AccountId || !await accounts.IsActiveVerifiedAsync(actor.AccountId, ct))
            throw Missing();
        var scope = Scope(archdioceseId);
        var operation = actor.CreateOperation(request.OperationId, request, clock, "bishop-invitation:" + archdioceseId + ":" + id);
        if (await records.ReplayAsync<BishopAppointment>(scope, operation, ct) is { } prior)
            return prior;
        var organization = await VerifiedOrganization(archdioceseId, ct);
        var appointment = row.Value;
        if (appointment.Status != "Invited" || appointment.AcceptBy <= clock.GetUtcNow()
            || appointment.EndsAt <= clock.GetUtcNow() || appointment.ReviewedBy is null)
            throw State("Only the named nominee can respond to a current reviewed invitation.");
        var changes = new List<RecordChange>
        {
            RecordChange.Replace("organization", "organization", organization.Value, organization.Version)
        };
        if (request.Accept.Value)
        {
            await UnoccupiedSeat(scope, ct);
            changes.Add(RecordChange.Create("bishopSeat", "bishopSeat", new BishopSeat { AppointmentId = id }));
        }
        appointment.Status = request.Accept.Value ? "Accepted" : "Declined";
        appointment.RespondedAt = clock.GetUtcNow();
        appointment.ResponseReason = string.IsNullOrWhiteSpace(request.Reason) ? null : Guard.Text(request.Reason, "Response reason", 2000);
        changes.Add(RecordChange.Replace(Key(id), "bishopAppointment", appointment, Versions.Require(request.Version)));
        return await records.CommitAsync(scope, operation, "bishop_appointment.responded", id, changes, appointment, ct, appointment.ResponseReason);
    }

    public async Task<Versioned<BishopAppointmentDto>> GetAsync(string archdioceseId, string id, CancellationToken ct)
    {
        var row = await Read(archdioceseId, id, ct);
        var own = row.Value.AccountId == actor.AccountId;
        if (own)
        {
            if (!await accounts.IsActiveVerifiedAsync(actor.AccountId, ct))
                throw Missing();
        }
        else
        {
            try
            { await platform.RequireOperatorAsync(ct); }
            catch (DomainException error) when (error.Kind == FailureKind.Forbidden) { throw Missing(); }
        }
        return new Versioned<BishopAppointmentDto>
        {
            Value = BishopAppointmentDto.From(row.Value, clock.GetUtcNow(), includeEvidence: !own),
            Version = row.Version
        };
    }

    private async Task<Versioned<Archdiocese>> VerifiedOrganization(string id, CancellationToken ct)
    {
        var row = await organizations.GetArchdioceseAsync(id, ct) ?? throw Missing();
        if (!row.Value.Verified)
            throw State("Verify the real organization's responsible representative before appointing its bishop.");
        return row;
    }

    private async Task<Versioned<BishopAppointment>> Read(string archdioceseId, string id, CancellationToken ct)
    {
        var row = await records.ReadAsync<BishopAppointment>(Scope(archdioceseId), Key(id), ct) ?? throw Missing();
        if (row.Value.Id != id || row.Value.ArchdioceseId != archdioceseId)
            throw Missing();
        return row;
    }

    private async Task UnoccupiedSeat(RecordScope scope, CancellationToken ct)
    {
        if (await records.ReadAsync<BishopSeat>(scope, "bishopSeat", ct) is not null)
            throw State("A first bishop is already recorded. A later replacement requires the separate succession workflow.");
    }
}
