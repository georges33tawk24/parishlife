// Purpose: manages bishop-authorized staff appointments and head designations with accepted dates, explicit duties, history and conditional scope fences.
// Main functions: InviteAsync, DecideAsync, ActAsync, DesignateHeadAsync, EndHeadAsync, GetAsync, ListAsync, OwnAsync, ScopeAsync, WorkspaceAsync; helpers enforce current authority and interval conflicts.

using ParishLife.Api.Authorization;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Services.Organizations;

public class StaffAppointmentService(IRecordTransactions records, IParishRepository parishes, ICurrentActor actor,
    IAccountDirectory accounts, IArchdioceseAuthority bishops, StaffAppointmentAccess access, IStaffAppointmentDirectory directory,
    MfaAccountAccess proof, TimeProvider clock)
{
    private class AppointmentScope
    {
        public required RecordScope Scope { get; init; }
        public required object Root { get; init; }
        public required string Version { get; init; }
        public required string RootKey { get; init; }
        public required string Name { get; init; }
        public Parish? Parish { get; init; }
        public RecordChange Fence(string? expected = null) => RecordChange.Replace(RootKey, RootKey, Root, expected ?? Version);
    }

    public async Task<Versioned<AppointmentScopeDto>> ScopeAsync(string archdioceseId, string? parishId, CancellationToken ct)
    {
        await bishops.RequireBishopAsync(archdioceseId, ct);
        var context = await ContextAsync(archdioceseId, parishId, ct);
        return new Versioned<AppointmentScopeDto>
        {
            Value = new AppointmentScopeDto
            {
                ArchdioceseId = archdioceseId,
                ParishId = parishId,
                Name = context.Name,
                ParishStatus = context.Parish?.Status
            },
            Version = context.Version
        };
    }

    public async Task<StaffAppointmentDto> InviteAsync(string archdioceseId, string? parishId, InviteStaffAppointmentDto request, CancellationToken ct)
    {
        var bishop = await FreshBishopAsync(archdioceseId, request.CurrentPassword, request.CurrentCode, ct);
        var context = await ContextAsync(archdioceseId, parishId, ct);
        var expectedRole = parishId is null ? StaffAppointmentRole.ArchdioceseAdmin : StaffAppointmentRole.Priest;
        if (request.Role != expectedRole || request.IsHead && expectedRole != StaffAppointmentRole.Priest)
            throw new DomainException("invalid_staff_role", "Choose the role appropriate to this exact organization scope.");
        if (context.Parish?.Status == ParishStatus.Closed)
            throw State("This parish is closed for new appointments.");
        StaffAppointmentRules.ValidateDuties(expectedRole, request.Allows, request.Denies);
        StaffAppointmentRules.ValidateDates(request.StartsAt, request.EndsAt, request.AcceptBy, request.ReviewDueAt, clock.GetUtcNow());
        var account = Guard.Id(request.AccountId);
        if (account == actor.AccountId || !await accounts.IsActiveVerifiedAsync(account, ct))
            throw new DomainException("nominee_unavailable", "Invite another existing active verified account.");
        var operation = Operation.Create(request.OperationId, actor.AccountId, new
        {
            Kind = "staff.invite",
            ArchdioceseId = archdioceseId,
            ParishId = parishId,
            request.ScopeVersion,
            request.AccountId,
            request.Role,
            request.Allows,
            request.Denies,
            request.StartsAt,
            request.EndsAt,
            request.AcceptBy,
            request.ReviewDueAt,
            request.IsHead,
            request.Reason,
            request.EvidenceReference
        }, clock, actingAppointmentId: bishop.Value.Id);
        if (await records.ReplayAsync<StaffAppointment>(context.Scope, operation, ct) is { } prior)
            return View((await ReadAsync(context.Scope, archdioceseId, parishId, prior.Id, ct)).Value, context.Name, true);
        var value = new StaffAppointment
        {
            Id = operation.Id,
            ArchdioceseId = archdioceseId,
            ParishId = parishId,
            AccountId = account,
            Role = expectedRole,
            ScopeName = context.Name,
            Allows = request.Allows.Order(StringComparer.Ordinal).ToArray(),
            Denies = request.Denies.Order(StringComparer.Ordinal).ToArray(),
            StartsAt = request.StartsAt,
            EndsAt = request.EndsAt,
            AcceptBy = request.AcceptBy,
            ReviewDueAt = request.ReviewDueAt,
            InvitedBy = actor.AccountId,
            InvitedAt = clock.GetUtcNow(),
            AuthorizingBishopAppointmentId = bishop.Value.Id,
            Reason = Guard.Text(request.Reason, "Appointment reason", 2000),
            EvidenceReference = Guard.Text(request.EvidenceReference, "Actual appointment evidence", 500),
            HeadStartsAt = request.IsHead ? request.StartsAt : null,
            HeadEndsAt = request.IsHead ? request.EndsAt : null
        };
        return View(await records.CommitAsync(context.Scope, operation, "staff_appointment.invited", value.Id,
            [context.Fence(Versions.Require(request.ScopeVersion)), RecordChange.Create(StaffAppointmentAccess.Key(value.Id), "staffAppointment", value)],
            value, ct, value.Reason), context.Name, true);
    }

    public async Task<StaffAppointmentDto> DecideAsync(string archdioceseId, string? parishId, string id, DecideStaffAppointmentDto request, CancellationToken ct)
    {
        if (request.Accept is null)
            throw new DomainException("decision_required", "Explicitly accept or decline this invitation.");
        await proof.RequireMfaAsync(ct);
        if (actor.ActingAppointmentId is not null)
            throw new DomainException("personal_capacity_required", "Clear the appointment selection when responding to your own invitation.", FailureKind.Forbidden);
        var context = await ContextAsync(archdioceseId, parishId, ct);
        var row = await ReadAsync(context.Scope, archdioceseId, parishId, id, ct);
        if (row.Value.AccountId != actor.AccountId)
            throw Missing();
        var operation = actor.CreateOperation(request.OperationId, request, clock, "staff-response:" + id);
        if (await records.ReplayAsync<StaffAppointment>(context.Scope, operation, ct) is { } prior)
            return View((await ReadAsync(context.Scope, archdioceseId, parishId, prior.Id, ct)).Value, context.Name);
        var value = row.Value;
        if (value.Status != "Invited" || value.AcceptBy <= clock.GetUtcNow() || value.EndsAt <= clock.GetUtcNow())
            throw State("Only a current pending invitation can be accepted or declined.");
        if (request.Accept.Value)
        {
            if (context.Parish?.Status == ParishStatus.Closed)
                throw State("This parish is closed for new appointments.");
            await IssuingBishopCurrentAsync(value, ct);
            value.Status = "Accepted";
            value.RespondedAt = clock.GetUtcNow();
            await NoConflictAsync(context, value, ct);
        }
        else
        {
            value.Status = "Declined";
            value.RespondedAt = clock.GetUtcNow();
        }
        value.ResponseReason = string.IsNullOrWhiteSpace(request.Reason) ? null : Guard.Text(request.Reason, "Response reason", 2000);
        return View(await records.CommitAsync(context.Scope, operation, "staff_appointment.responded", id,
            [context.Fence(), RecordChange.Replace(StaffAppointmentAccess.Key(id), "staffAppointment", value, Versions.Require(request.Version))],
            value, ct, value.ResponseReason), context.Name);
    }

    public async Task<StaffAppointmentDto> ActAsync(string archdioceseId, string? parishId, string id, ActStaffAppointmentDto request, CancellationToken ct)
    {
        var bishop = await FreshBishopAsync(archdioceseId, request.CurrentPassword, request.CurrentCode, ct);
        if (request.Action is null || !Enum.IsDefined(request.Action.Value))
            throw new DomainException("invalid_staff_action", "Choose a supported appointment action.");
        if (request.Action != StaffAppointmentAction.Review && request.ReviewDueAt is not null)
            throw new DomainException("invalid_review_date", "Change the review date only through the explicit review action.");
        var context = await ContextAsync(archdioceseId, parishId, ct);
        var operation = Operation.Create(request.OperationId, actor.AccountId,
            new { Kind = "staff.action", ArchdioceseId = archdioceseId, ParishId = parishId, Id = id, request.Action, request.Version, request.Reason, request.ReviewDueAt },
            clock, actingAppointmentId: bishop.Value.Id);
        if (await records.ReplayAsync<StaffAppointment>(context.Scope, operation, ct) is { } prior)
            return View((await ReadAsync(context.Scope, archdioceseId, parishId, prior.Id, ct)).Value, context.Name, true);
        var row = await ReadAsync(context.Scope, archdioceseId, parishId, id, ct);
        var value = row.Value;
        var reason = Guard.Text(request.Reason, "Action reason", 2000);
        var changes = new List<RecordChange> { context.Fence() };
        switch (request.Action.Value)
        {
            case StaffAppointmentAction.Suspend:
                if (value.Status != "Accepted" || value.EndsAt <= clock.GetUtcNow())
                    throw State("Suspend only a current accepted appointment.");
                value.Status = "Suspended";
                break;
            case StaffAppointmentAction.Resume:
                if (value.Status != "Suspended" || value.EndsAt <= clock.GetUtcNow() || context.Parish?.Status == ParishStatus.Closed)
                    throw State("Resume only an unexpired suspended appointment in an open scope.");
                value.Status = "Accepted";
                await NoConflictAsync(context, value, ct);
                break;
            case StaffAppointmentAction.Revoke:
                if (value.Status is not ("Invited" or "Accepted" or "Suspended"))
                    throw State("This appointment can no longer be revoked.");
                value.Status = "Revoked";
                break;
            case StaffAppointmentAction.Review:
                if (value.Status is not ("Accepted" or "Suspended"))
                    throw State("Review an accepted or suspended appointment.");
                if (request.ReviewDueAt is { } due && (Guard.Utc(due) <= clock.GetUtcNow() || value.EndsAt is { } end && due >= end))
                    throw new DomainException("invalid_review_date", "The next review must be future and within the appointment period.");
                var review = new StaffAppointmentReview
                {
                    Id = operation.Id,
                    AppointmentId = id,
                    ReviewedBy = actor.AccountId,
                    ReviewedAt = clock.GetUtcNow(),
                    Reason = reason,
                    PreviousDueAt = value.ReviewDueAt,
                    NewDueAt = request.ReviewDueAt ?? value.ReviewDueAt
                };
                value.LastReviewedAt = review.ReviewedAt;
                value.LastReviewedBy = actor.AccountId;
                value.ReviewDueAt = review.NewDueAt;
                changes.Add(RecordChange.Create("staffReview:" + operation.Id, "staffAppointmentReview", review));
                break;
        }
        value.LastActionAt = clock.GetUtcNow();
        value.LastActionBy = actor.AccountId;
        value.LastActionReason = reason;
        changes.Add(RecordChange.Replace(StaffAppointmentAccess.Key(id), "staffAppointment", value, Versions.Require(request.Version)));
        return View(await records.CommitAsync(context.Scope, operation, "staff_appointment." + request.Action.Value.ToString().ToLowerInvariant(), id,
            changes, value, ct, reason), context.Name, true);
    }

    public async Task<StaffAppointmentDto> DesignateHeadAsync(string archdioceseId, string parishId, string id, DesignateHeadPriestDto request, CancellationToken ct)
    {
        var bishop = await FreshBishopAsync(archdioceseId, request.CurrentPassword, request.CurrentCode, ct);
        var context = await ContextAsync(archdioceseId, parishId, ct);
        var operation = Operation.Create(request.OperationId, actor.AccountId,
            new { Kind = "staff.head.designate", ArchdioceseId = archdioceseId, ParishId = parishId, Id = id, request.Version, request.StartsAt, request.EndsAt, request.Reason, request.EvidenceReference },
            clock, actingAppointmentId: bishop.Value.Id);
        if (await records.ReplayAsync<StaffAppointment>(context.Scope, operation, ct) is { } prior)
            return View((await ReadAsync(context.Scope, archdioceseId, parishId, prior.Id, ct)).Value, context.Name, true);
        var row = await ReadAsync(context.Scope, archdioceseId, parishId, id, ct);
        var value = row.Value;
        if (value.Role != StaffAppointmentRole.Priest || value.Status != "Accepted" || value.EndsAt <= clock.GetUtcNow()
            || context.Parish?.Status == ParishStatus.Closed || value.HasHeadPeriod && (value.HeadEndsAt is null || value.HeadEndsAt > clock.GetUtcNow()))
            throw State("Use an accepted priest appointment with no current or future head designation; explicitly end an existing designation first.");
        var start = Guard.Utc(request.StartsAt);
        if (start < clock.GetUtcNow() || start < value.EffectiveStart
            || request.EndsAt is { } end && Guard.Utc(end) <= start
            || value.EndsAt is { } last && (request.EndsAt is null || request.EndsAt > last))
            throw new DomainException("invalid_head_period", "Use a nonhistorical head period within the accepted priest appointment.");
        var change = HeadChange(operation.Id, value, request.Reason, request.EvidenceReference);
        value.HeadStartsAt = start;
        value.HeadEndsAt = request.EndsAt;
        change.NewStartsAt = start;
        change.NewEndsAt = request.EndsAt;
        await NoConflictAsync(context, value, ct);
        return View(await CommitHeadAsync(context, row, operation, change, request.Version, ct), context.Name, true);
    }

    public async Task<StaffAppointmentDto> EndHeadAsync(string archdioceseId, string parishId, string id, EndHeadPriestDto request, CancellationToken ct)
    {
        var bishop = await FreshBishopAsync(archdioceseId, request.CurrentPassword, request.CurrentCode, ct);
        var context = await ContextAsync(archdioceseId, parishId, ct);
        var operation = Operation.Create(request.OperationId, actor.AccountId,
            new { Kind = "staff.head.end", ArchdioceseId = archdioceseId, ParishId = parishId, Id = id, request.Version, request.EndsAt, request.Reason, request.EvidenceReference },
            clock, actingAppointmentId: bishop.Value.Id);
        if (await records.ReplayAsync<StaffAppointment>(context.Scope, operation, ct) is { } prior)
            return View((await ReadAsync(context.Scope, archdioceseId, parishId, prior.Id, ct)).Value, context.Name, true);
        var row = await ReadAsync(context.Scope, archdioceseId, parishId, id, ct);
        var value = row.Value;
        var end = Guard.Utc(request.EndsAt);
        if (!value.HasHeadPeriod || !value.ReservesPeriod || end < clock.GetUtcNow() || end < value.HeadStartsAt
            || value.HeadEndsAt is { } last && end > last || value.EndsAt is { } roleEnd && end > roleEnd)
            throw new DomainException("invalid_head_period", "Explicitly end or cancel the reserved head period without extending it or backdating changes.");
        var change = HeadChange(operation.Id, value, request.Reason, request.EvidenceReference);
        value.HeadEndsAt = end;
        change.NewStartsAt = value.HeadStartsAt;
        change.NewEndsAt = end;
        return View(await CommitHeadAsync(context, row, operation, change, request.Version, ct), context.Name, true);
    }

    public async Task<Versioned<StaffAppointmentDto>> GetAsync(string archdioceseId, string? parishId, string id, CancellationToken ct)
    {
        var context = await ContextAsync(archdioceseId, parishId, ct);
        var row = await ReadAsync(context.Scope, archdioceseId, parishId, id, ct);
        var bishopView = false;
        if (row.Value.AccountId == actor.AccountId)
        {
            if (!await accounts.IsActiveVerifiedAsync(actor.AccountId, ct))
                throw Missing();
        }
        else
            bishopView = await access.RequireReaderAsync(archdioceseId, parishId, ct);
        return new Versioned<StaffAppointmentDto> { Value = View(row.Value, context.Name, bishopView), Version = row.Version };
    }

    public async Task<Page<Versioned<StaffAppointmentDto>>> ListAsync(string archdioceseId, string? parishId, int size, string? cursor, CancellationToken ct)
    {
        var bishopView = await access.RequireReaderAsync(archdioceseId, parishId, ct);
        var context = await ContextAsync(archdioceseId, parishId, ct);
        var page = await records.PageAsync<StaffAppointment>(context.Scope, "staffAppointment", size, cursor, ct);
        return new Page<Versioned<StaffAppointmentDto>>
        {
            Items = page.Items.Select(row => new Versioned<StaffAppointmentDto> { Value = View(row.Value, context.Name, bishopView), Version = row.Version }).ToArray(),
            ContinuationToken = page.ContinuationToken
        };
    }

    public async Task<AppointmentWorkspaceDto> WorkspaceAsync(string archdioceseId, string? parishId, string id, CancellationToken ct)
    {
        var row = await access.RequireOwnAsync(archdioceseId, parishId, id, ct);
        var context = await ContextAsync(archdioceseId, parishId, ct);
        var denies = parishId is null ? [] : (await parishes.GetGrantAsync(parishId, actor.AccountId, ct))?.Denies ?? [];
        var appointments = parishId is null ? [] : await AppointmentsAsync(context, ct);
        var now = clock.GetUtcNow();
        return new AppointmentWorkspaceDto
        {
            Appointment = View(row.Value, context.Name),
            OrganizationName = context.Name,
            Capabilities = row.Value.Allows.Except(row.Value.Denies.Concat(denies), StringComparer.Ordinal).ToArray(),
            HasCurrentHead = parishId is null ? null : appointments.Any(value => value.Value.IsHead(now)),
            HasHeadReservation = parishId is null ? null : appointments.Any(value => value.Value.ReservesPeriod && value.Value.HasHeadPeriod
                && (value.Value.HeadEndsAt is null || now < value.Value.HeadEndsAt))
        };
    }

    public async Task<Page<Versioned<StaffAppointmentDto>>> OwnAsync(int size, string? cursor, CancellationToken ct)
    {
        if (!await accounts.IsActiveVerifiedAsync(actor.AccountId, ct))
            throw Missing();
        var page = await directory.ForAccountAsync(actor.AccountId, size, cursor, ct);
        return new Page<Versioned<StaffAppointmentDto>>
        {
            Items = page.Items.Select(row => new Versioned<StaffAppointmentDto>
            {
                Value = View(row.Value, row.Value.ScopeName),
                Version = row.Version
            }).ToArray(),
            ContinuationToken = page.ContinuationToken
        };
    }

    private async Task<Versioned<BishopAppointment>> FreshBishopAsync(string id, string password, string code, CancellationToken ct)
    {
        var bishop = await bishops.RequireBishopAppointmentAsync(id, ct);
        var user = await proof.RequireMfaAsync(ct);
        await proof.PasswordAsync(user, password);
        await proof.AuthenticatorAsync(user, code);
        return bishop;
    }

    private async Task<AppointmentScope> ContextAsync(string archdioceseId, string? parishId, CancellationToken ct)
    {
        var organization = await parishes.GetArchdioceseAsync(archdioceseId, ct) ?? throw Missing();
        if (!organization.Value.Verified)
            throw Missing();
        if (parishId is null)
            return new AppointmentScope
            {
                Scope = StaffAppointmentAccess.Scope(archdioceseId, null),
                Root = organization.Value,
                Version = organization.Version,
                RootKey = "organization",
                Name = organization.Value.Name
            };
        var parish = await parishes.GetAsync(parishId, ct) ?? throw Missing();
        if (parish.Value.JurisdictionArchdioceseId != archdioceseId)
            throw Missing();
        return new AppointmentScope
        {
            Scope = StaffAppointmentAccess.Scope(archdioceseId, parishId),
            Root = parish.Value,
            Version = parish.Version,
            RootKey = "parish",
            Name = parish.Value.Name,
            Parish = parish.Value
        };
    }

    private async Task<Versioned<StaffAppointment>> ReadAsync(RecordScope scope, string archdioceseId, string? parishId, string id, CancellationToken ct)
    {
        var row = await records.ReadAsync<StaffAppointment>(scope, StaffAppointmentAccess.Key(id), ct) ?? throw Missing();
        if (row.Value.Id != id || row.Value.ArchdioceseId != archdioceseId || row.Value.ParishId != parishId)
            throw Missing();
        return row;
    }

    private async Task IssuingBishopCurrentAsync(StaffAppointment value, CancellationToken ct)
    {
        var scope = StaffAppointmentAccess.Scope(value.ArchdioceseId, null);
        var seat = await records.ReadAsync<BishopSeat>(scope, "bishopSeat", ct);
        var bishop = seat is null ? null : await records.ReadAsync<BishopAppointment>(scope, "bishopAppointment:" + seat.Value.AppointmentId, ct);
        if (bishop is null || bishop.Value.Id != value.AuthorizingBishopAppointmentId || bishop.Value.AccountId != value.InvitedBy
            || !bishop.Value.IsEffective(clock.GetUtcNow()) || !await proof.IsVerifiedMfaAccountAsync(value.InvitedBy, ct))
            throw State("The issuing bishop's authority must be current when the invitation is accepted.");
    }

    private Task<IReadOnlyList<Versioned<StaffAppointment>>> AppointmentsAsync(AppointmentScope context, CancellationToken ct)
        => records.CollectAsync<StaffAppointment>(context.Scope, "staffAppointment", ct);

    private async Task NoConflictAsync(AppointmentScope context, StaffAppointment candidate, CancellationToken ct)
    {
        foreach (var row in await AppointmentsAsync(context, ct))
        {
            var other = row.Value;
            if (other.Id == candidate.Id || !other.ReservesPeriod)
                continue;
            if (other.Role == candidate.Role && other.AccountId == candidate.AccountId
                && StaffAppointmentRules.Overlaps(candidate.EffectiveStart, candidate.EndsAt, other.EffectiveStart, other.EndsAt))
                throw State("This account already has a reserved appointment for the same role and overlapping period.");
            if (candidate.HasHeadPeriod && other.HasHeadPeriod && HeadOverlap(candidate, other))
                throw new DomainException("head_priest_conflict", "Another accepted or suspended head designation reserves an overlapping period.", FailureKind.Conflict);
        }
    }

    private static bool HeadOverlap(StaffAppointment first, StaffAppointment second)
    {
        var a = first.HeadStartsAt!.Value > first.EffectiveStart ? first.HeadStartsAt.Value : first.EffectiveStart;
        var b = second.HeadStartsAt!.Value > second.EffectiveStart ? second.HeadStartsAt.Value : second.EffectiveStart;
        return (first.HeadEndsAt is null || first.HeadEndsAt > a) && (second.HeadEndsAt is null || second.HeadEndsAt > b)
            && StaffAppointmentRules.Overlaps(a, first.HeadEndsAt, b, second.HeadEndsAt);
    }

    private HeadDesignationChange HeadChange(string id, StaffAppointment value, string reason, string evidence) => new()
    {
        Id = id,
        AppointmentId = value.Id,
        ParishId = value.ParishId!,
        PreviousStartsAt = value.HeadStartsAt,
        PreviousEndsAt = value.HeadEndsAt,
        RecordedBy = actor.AccountId,
        RecordedAt = clock.GetUtcNow(),
        Reason = Guard.Text(reason, "Head designation reason", 2000),
        EvidenceReference = Guard.Text(evidence, "Actual designation evidence", 500)
    };

    private Task<StaffAppointment> CommitHeadAsync(AppointmentScope context, Versioned<StaffAppointment> row, Operation operation,
        HeadDesignationChange change, string expected, CancellationToken ct) => records.CommitAsync(context.Scope, operation, "staff_appointment.head_changed", row.Value.Id,
            [context.Fence(), RecordChange.Replace(StaffAppointmentAccess.Key(row.Value.Id), "staffAppointment", row.Value, Versions.Require(expected)),
             RecordChange.Create("headChange:" + operation.Id, "headDesignationChange", change)], row.Value, ct, change.Reason);

    private StaffAppointmentDto View(StaffAppointment value, string name, bool evidence = false)
    {
        var now = clock.GetUtcNow();
        var status = value.Status;
        if (status == "Invited" && value.AcceptBy <= now || status is "Accepted" or "Suspended" && value.EndsAt <= now)
            status = "Expired";
        else if (status == "Accepted")
            status = value.IsEffective(now) ? "Active" : "Scheduled";
        return new StaffAppointmentDto
        {
            Id = value.Id,
            ArchdioceseId = value.ArchdioceseId,
            ParishId = value.ParishId,
            AccountId = value.AccountId,
            ScopeName = name,
            Role = value.Role,
            Allows = [.. value.Allows],
            Denies = [.. value.Denies],
            Status = status,
            Effective = value.IsEffective(now),
            Head = value.IsHead(now),
            StartsAt = value.StartsAt,
            EndsAt = value.EndsAt,
            AcceptBy = value.AcceptBy,
            ReviewDueAt = value.ReviewDueAt,
            ReviewOverdue = value.IsEffective(now) && value.ReviewDueAt <= now && (value.LastReviewedAt is null || value.LastReviewedAt < value.ReviewDueAt),
            InvitedBy = value.InvitedBy,
            InvitedAt = value.InvitedAt,
            RespondedAt = value.RespondedAt,
            LastReviewedAt = value.LastReviewedAt,
            HeadStartsAt = value.HeadStartsAt,
            HeadEndsAt = value.HeadEndsAt,
            Reason = value.Reason,
            LastActionReason = value.LastActionReason,
            EvidenceReference = evidence ? value.EvidenceReference : null
        };
    }

    private static DomainException Missing() => new("appointment_unavailable", "The appointment is unavailable.", FailureKind.NotFound);
    private static DomainException State(string message) => new("invalid_staff_appointment_state", message, FailureKind.Conflict);
}
