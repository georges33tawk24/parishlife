using Microsoft.EntityFrameworkCore;
using ParishLive.Application.Abstractions;
using ParishLive.Application.Audit;
using ParishLive.Application.Authorization;
using ParishLive.Application.Reservations;
using ParishLive.Domain.Common;
using ParishLive.Domain.Entities;
using ParishLive.Domain.Enums;
using ParishLive.Domain.Constants;
using ParishLive.Application.Common;
using ParishLive.Infrastructure.Data;

namespace ParishLive.Infrastructure.Reservations;

/// <summary>
/// Reservation use-cases driven by the configurable workflow engine. Every read/write is tenant-scoped
/// (the DbContext filters + guard do the isolation); the legal set of actions comes entirely from the
/// workflow transitions in the database.
/// </summary>
public sealed class ReservationService(AppDbContext db, ITenantContext tenant, IPermissionService permissions, IAuditService audit) : IReservationService
{
    public async Task<Guid> CreateAsync(CreateReservationRequest request, CancellationToken cancellationToken = default)
    {
        var parishId = tenant.ParishIds.Count == 1 ? tenant.ParishIds.Single() : Guid.Empty;
        if (parishId == Guid.Empty)
            throw new DomainException("No parish context for the reservation.");
        if (tenant.UserId is null || request.RequestedByUserId != tenant.UserId)
            throw new ForbiddenException("Error.Unavailable");
        if (!await db.Parishes.AnyAsync(p => p.Id == parishId && p.Lifecycle == "Active", cancellationToken))
            throw new DomainException("Error.Unavailable");
        await permissions.RequireAsync(tenant.UserId, parishId, PermissionCodes.Reservations.Create, cancellationToken);
        var venue = await db.Venues.SingleOrDefaultAsync(v => v.Id == request.VenueId && v.ParishId == parishId, cancellationToken)
            ?? throw new DomainException("Error.Unavailable");
        if (request.GroupId is not null && !await db.Groups.AnyAsync(g => g.Id == request.GroupId && g.ParishId == parishId, cancellationToken))
            throw new DomainException("Error.Unavailable");
        if (request.GroupId is Guid representedGroup && tenant.ActingRole is not ("Priest" or "Secretary" or "ParishAdmin") &&
            !await db.GroupMembers.AnyAsync(m => m.GroupId == representedGroup && m.UserId == tenant.UserId && m.EndDate == null, cancellationToken))
            throw new ForbiddenException("Error.Representation");
        if (request.StartUtc <= DateTimeOffset.UtcNow) throw new DomainException("Error.Invalid");
        if (!venue.IsServiceable || request.ExpectedAttendees > venue.Capacity) throw new DomainException("Error.Capacity");

        return (await new OperationRunner(db, tenant).RunAsync(parishId, request.OperationId ?? Guid.NewGuid(),
            "Reservation.Create", request, async () =>
        {
        var definition = await ResolveDefinitionAsync(parishId, cancellationToken);
        var initialState = await db.WorkflowStates
            .FirstAsync(s => s.WorkflowDefinitionId == definition.Id && s.IsInitial, cancellationToken);

        var reservation = Reservation.Create(
            tenant.OrgId, parishId, request.GroupId, request.VenueId, request.RequestedByUserId,
            request.Title, request.Description, request.StartUtc, request.EndUtc, request.ExpectedAttendees,
            definition.Id, initialState.Id);
        reservation.SetupMinutes = venue.SetupMinutes;
        reservation.CleanupMinutes = venue.CleanupMinutes;

        db.Reservations.Add(reservation);
        await db.SaveChangesAsync(cancellationToken);
        return new OperationResult(reservation.Id, reservation.Revision);
        })).Id;
    }

    public async Task PerformActionAsync(Guid reservationId, string actionCode, string? note, string actorUserId, CancellationToken cancellationToken = default)
    {
        var current = await db.Reservations.AsNoTracking().SingleOrDefaultAsync(r => r.Id == reservationId, cancellationToken)
            ?? throw new DomainException("Error.Unavailable");
        await PerformCheckedActionAsync(reservationId, current.Revision, Guid.NewGuid(), actionCode, note, actorUserId, cancellationToken);
    }

    public async Task PerformCheckedActionAsync(Guid reservationId, long revision, Guid operationId, string actionCode,
        string? note, string actorUserId, CancellationToken cancellationToken = default)
    {
        if (actorUserId != tenant.UserId) throw new ForbiddenException("Error.Unavailable");
        var reservation = await db.Reservations.FirstOrDefaultAsync(r => r.Id == reservationId, cancellationToken)
            ?? throw new DomainException("Reservation not found.");
        if (!await CanReadAsync(reservation)) throw new ForbiddenException("Error.Unavailable");
        await new OperationRunner(db, tenant).RunAsync(reservation.ParishId, operationId, "Reservation." + actionCode,
            new { reservationId, revision, actionCode, note }, async () =>
        {
        if (reservation.Revision != revision) throw new DomainException("Error.Conflict");
        var transition = await db.WorkflowTransitions.FirstOrDefaultAsync(t =>
                t.WorkflowDefinitionId == reservation.WorkflowDefinitionId &&
                t.FromStateId == reservation.CurrentStateId &&
                t.ActionCode == actionCode && t.IsActive, cancellationToken)
            ;
        // Optional office preparation must not prevent a qualified priest deciding directly.
        if (transition is null && actionCode == "Approve")
        {
            var current = await db.WorkflowStates.SingleAsync(s => s.Id == reservation.CurrentStateId, cancellationToken);
            if (!current.IsTerminal)
            {
                var approved = await db.WorkflowStates.SingleAsync(s => s.WorkflowDefinitionId == reservation.WorkflowDefinitionId && s.Code == "Approved", cancellationToken);
                transition = WorkflowTransition.Create(reservation.WorkflowDefinitionId, current.Id, approved.Id,
                    "Approve", "Approve", PermissionCodes.Reservations.Approve, false, true);
            }
        }
        if (transition is null) throw new DomainException("Error.State");

        // Enforce the permission the transition demands (e.g. a secretary cannot Approve).
        if (transition.RequiredPermissionCode is not null)
            await permissions.RequireAsync(actorUserId, reservation.ParishId, transition.RequiredPermissionCode, cancellationToken);

        if (actionCode is "SubmitForReview" && reservation.RequestedByUserId != actorUserId)
            throw new ForbiddenException("Error.Unavailable");
        if (actionCode == "Approve")
        {
            var venue = await db.Venues.SingleAsync(v => v.Id == reservation.VenueId, cancellationToken);
            await db.Entry(venue).ReloadAsync(cancellationToken);
            if (!venue.IsServiceable || reservation.ExpectedAttendees > venue.Capacity) throw new DomainException("Error.Capacity");
            var committed = await (from r in db.Reservations.AsNoTracking()
                join s in db.WorkflowStates on r.CurrentStateId equals s.Id
                where r.VenueId == reservation.VenueId && r.Id != reservation.Id && (s.Code == "Approved" || r.HoldExpiresAtUtc != null)
                select new { Reservation = r, Confirmed = s.Code == "Approved" }).ToListAsync(cancellationToken);
            var start = reservation.StartUtc.AddMinutes(-reservation.SetupMinutes);
            var end = reservation.EndUtc.AddMinutes(reservation.CleanupMinutes);
            if (committed.Any(x => (x.Confirmed || x.Reservation.HoldExpiresAtUtc > DateTimeOffset.UtcNow) &&
                x.Reservation.StartUtc.AddMinutes(-x.Reservation.SetupMinutes) < end &&
                x.Reservation.EndUtc.AddMinutes(x.Reservation.CleanupMinutes) > start)) throw new DomainException("Error.ResourceConflict");
            venue.Revision++; // optimistic resource lock protects different requests competing for one interval
        }

        var history = reservation.ApplyTransition(transition, actorUserId, note);
        reservation.Revision++;
        db.ReservationStateHistory.Add(history);
        db.AuditLogs.Add(AuditLog.Create(reservation.OrgId, reservation.ParishId, actorUserId,
            "reservation." + actionCode, "Reservation", reservation.Id, transition.ActionName));
        await db.SaveChangesAsync(cancellationToken);
        return new OperationResult(reservation.Id, reservation.Revision);
        });
    }

    public async Task<IReadOnlyList<ReservationListItem>> ListAsync(CancellationToken cancellationToken = default)
    {
        var items = await (
            from r in db.Reservations
            join g in db.Groups on r.GroupId equals g.Id into groups
            from g in groups.DefaultIfEmpty()
            join v in db.Venues on r.VenueId equals v.Id
            join s in db.WorkflowStates on r.CurrentStateId equals s.Id
            select new ReservationListItem(r.Id, r.Title, g == null ? "" : g.Name, v.Name, r.StartUtc, s.Code, s.Name))
            .ToListAsync(cancellationToken);

        // Order client-side: SQLite (dev/test) can't ORDER BY DateTimeOffset. Bounded per parish.
        var allowed = new List<ReservationListItem>();
        foreach (var item in items)
        {
            var record = await db.Reservations.SingleAsync(r => r.Id == item.Id, cancellationToken);
            if (await CanReadAsync(record)) allowed.Add(item);
        }
        return allowed.OrderBy(i => i.StartUtc).ToList();
    }

    public async Task<IReadOnlyList<ReservationListItem>> ListAwaitingActionAsync(CancellationToken cancellationToken = default)
    {
        var userId = tenant.UserId;
        var parishId = tenant.ParishIds.FirstOrDefault();
        if (userId is null || parishId == Guid.Empty)
            return [];

        var granted = await permissions.GetPermissionsAsync(userId, parishId, cancellationToken);
        var office = granted.Contains(PermissionCodes.Reservations.Review) || granted.Contains(PermissionCodes.Reservations.Approve);

        var open = await (
            from r in db.Reservations
            join g in db.Groups on r.GroupId equals g.Id into groups
            from g in groups.DefaultIfEmpty()
            join v in db.Venues on r.VenueId equals v.Id
            join s in db.WorkflowStates on r.CurrentStateId equals s.Id
            where !s.IsTerminal && (office || r.RequestedByUserId == userId)
            select new
            {
                r.Id, r.Title, Group = g == null ? "" : g.Name, Venue = v.Name, r.StartUtc,
                r.CurrentStateId, r.WorkflowDefinitionId, StateCode = s.Code, StateName = s.Name
            }).ToListAsync(cancellationToken);

        var definitionIds = open.Select(o => o.WorkflowDefinitionId).Distinct().ToList();
        var transitions = await db.WorkflowTransitions
            .Where(t => definitionIds.Contains(t.WorkflowDefinitionId) && t.IsActive)
            .ToListAsync(cancellationToken);

        return open
            .Where(o => granted.Contains(PermissionCodes.Reservations.Approve) || transitions.Any(t =>
                t.WorkflowDefinitionId == o.WorkflowDefinitionId &&
                t.FromStateId == o.CurrentStateId &&
                (t.RequiredPermissionCode is null || granted.Contains(t.RequiredPermissionCode))))
            .OrderBy(o => o.StartUtc)
            .Select(o => new ReservationListItem(o.Id, o.Title, o.Group, o.Venue, o.StartUtc, o.StateCode, o.StateName))
            .ToList();
    }

    public async Task<ReservationDetail?> GetAsync(Guid reservationId, CancellationToken cancellationToken = default)
    {
        var reservation = await db.Reservations.FirstOrDefaultAsync(r => r.Id == reservationId, cancellationToken);
        if (reservation is null)
            return null;
        if (!await CanReadAsync(reservation)) return null;

        var groupName = await db.Groups.Where(g => g.Id == reservation.GroupId).Select(g => g.Name).FirstOrDefaultAsync(cancellationToken) ?? "";
        var venueName = await db.Venues.Where(v => v.Id == reservation.VenueId).Select(v => v.Name).FirstOrDefaultAsync(cancellationToken) ?? "";
        var state = await db.WorkflowStates.Where(s => s.Id == reservation.CurrentStateId).Select(s => new { s.Code, s.Name }).FirstAsync(cancellationToken);
        var requestedBy = await db.Users.Where(u => u.Id == reservation.RequestedByUserId).Select(u => u.DisplayName ?? u.Email!).FirstOrDefaultAsync(cancellationToken) ?? "";

        var candidateActions = await (
            from t in db.WorkflowTransitions
            where t.WorkflowDefinitionId == reservation.WorkflowDefinitionId
                  && t.FromStateId == reservation.CurrentStateId && t.IsActive
            orderby t.ActionName
            select new { t.ActionCode, t.ActionName, t.RequiresNote, t.RequiredPermissionCode }).ToListAsync(cancellationToken);

        // Only surface actions the viewer is permitted to perform.
        var granted = tenant.UserId is null
            ? new HashSet<string>()
            : (IReadOnlySet<string>)await permissions.GetPermissionsAsync(tenant.UserId, reservation.ParishId, cancellationToken);

        var actions = candidateActions
            .Where(a => a.RequiredPermissionCode is null || granted.Contains(a.RequiredPermissionCode))
            .Select(a => new AvailableAction(a.ActionCode, a.ActionName, a.RequiresNote))
            .ToList();
        if (!actions.Any(a => a.ActionCode == "Approve") && granted.Contains(PermissionCodes.Reservations.Approve) &&
            !await db.WorkflowStates.AnyAsync(s => s.Id == reservation.CurrentStateId && s.IsTerminal, cancellationToken))
            actions.Add(new AvailableAction("Approve", "Approve", false));

        var historyRows = (await (
            from h in db.ReservationStateHistory
            where h.ReservationId == reservation.Id
            join fs in db.WorkflowStates on h.FromStateId equals fs.Id
            join ts in db.WorkflowStates on h.ToStateId equals ts.Id
            join u in db.Users on h.ActorUserId equals u.Id into actor
            from u in actor.DefaultIfEmpty()
            select new
            {
                h.ActionCode, From = fs.Name, To = ts.Name,
                Actor = u != null ? (u.DisplayName ?? u.Email!) : h.ActorUserId,
                h.Note, h.CreatedAt
            }).ToListAsync(cancellationToken))
            .OrderBy(x => x.CreatedAt) // SQLite (dev/test) can't ORDER BY DateTimeOffset
            .ToList();

        // Map action codes to their display names via this definition's transitions.
        var actionNames = await db.WorkflowTransitions
            .Where(t => t.WorkflowDefinitionId == reservation.WorkflowDefinitionId)
            .Select(t => new { t.ActionCode, t.ActionName })
            .Distinct()
            .ToDictionaryAsync(x => x.ActionCode, x => x.ActionName, cancellationToken);

        var history = historyRows
            .Select(h => new HistoryEntry(
                actionNames.GetValueOrDefault(h.ActionCode, h.ActionCode),
                h.From, h.To, h.Actor, h.Note, h.CreatedAt))
            .ToList();

        return new ReservationDetail(
            reservation.Id, reservation.Title, reservation.Description, groupName, venueName,
            reservation.StartUtc, reservation.EndUtc, reservation.ExpectedAttendees, requestedBy,
            state.Code, state.Name, actions, history, reservation.Revision);
    }

    private async Task<bool> CanReadAsync(Reservation record) => tenant.UserId is not null &&
        (record.RequestedByUserId == tenant.UserId ||
            await permissions.HasAsync(tenant.UserId, record.ParishId, PermissionCodes.Reservations.Review) ||
            await permissions.HasAsync(tenant.UserId, record.ParishId, PermissionCodes.Reservations.Approve));

    private async Task<WorkflowDefinition> ResolveDefinitionAsync(Guid parishId, CancellationToken cancellationToken) =>
        await db.WorkflowDefinitions
            .Where(d => d.EntityType == WorkflowEntityType.Reservation && d.IsActive
                        && (d.ParishId == null || d.ParishId == parishId))
            .OrderByDescending(d => d.ParishId != null) // prefer a parish-specific override over the archdiocese default
            .ThenByDescending(d => d.Version)
            .FirstAsync(cancellationToken);
}
