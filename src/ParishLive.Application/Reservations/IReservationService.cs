namespace ParishLive.Application.Reservations;

/// <summary>
/// The reservation use-cases, driven by the configurable workflow engine. Implemented in Infrastructure;
/// consumed by the Web layer. Keeps EF and workflow lookups out of the pages.
/// </summary>
public interface IReservationService
{
    Task<Guid> CreateAsync(CreateReservationRequest request, CancellationToken cancellationToken = default);

    /// <summary>Performs a workflow action (e.g. "Forward", "Approve", "Reject") on a reservation.</summary>
    Task PerformActionAsync(Guid reservationId, string actionCode, string? note, string actorUserId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ReservationListItem>> ListAsync(CancellationToken cancellationToken = default);

    /// <summary>Reservations the current user can act on right now (their state has a transition they're permitted to perform).</summary>
    Task<IReadOnlyList<ReservationListItem>> ListAwaitingActionAsync(CancellationToken cancellationToken = default);

    Task<ReservationDetail?> GetAsync(Guid reservationId, CancellationToken cancellationToken = default);
}

public sealed record CreateReservationRequest(
    Guid GroupId, Guid VenueId, string RequestedByUserId, string Title, string? Description,
    DateTimeOffset StartUtc, DateTimeOffset EndUtc, int ExpectedAttendees);

public sealed record ReservationListItem(
    Guid Id, string Title, string GroupName, string VenueName,
    DateTimeOffset StartUtc, string StateCode, string StateName);

public sealed record ReservationDetail(
    Guid Id, string Title, string? Description, string GroupName, string VenueName,
    DateTimeOffset StartUtc, DateTimeOffset EndUtc, int ExpectedAttendees, string RequestedByName,
    string StateCode, string StateName,
    IReadOnlyList<AvailableAction> Actions, IReadOnlyList<HistoryEntry> History);

public sealed record AvailableAction(string ActionCode, string ActionName, bool RequiresNote);

public sealed record HistoryEntry(
    string ActionName, string FromState, string ToState, string ActorName, string? Note, DateTimeOffset At);
