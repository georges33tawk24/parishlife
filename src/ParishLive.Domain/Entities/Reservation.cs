using ParishLive.Domain.Common;

namespace ParishLive.Domain.Entities;

/// <summary>
/// A request to reserve a venue, moved through a configurable workflow. The entity owns its invariants:
/// it only accepts a transition that starts from its current state, and demands a note when the
/// transition requires one. Everything else (which transition is legal from here) is data in the
/// workflow engine, so parishes can reconfigure the approval chain without code changes.
/// </summary>
public sealed class Reservation : TenantEntity
{
    private Reservation() { }

    public Guid GroupId { get; private set; }
    public Guid VenueId { get; private set; }
    public string RequestedByUserId { get; private set; } = string.Empty;
    public string Title { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public DateTimeOffset StartUtc { get; private set; }
    public DateTimeOffset EndUtc { get; private set; }
    public int ExpectedAttendees { get; private set; }
    public Guid WorkflowDefinitionId { get; private set; }
    public Guid CurrentStateId { get; private set; }

    public static Reservation Create(
        Guid orgId, Guid parishId, Guid groupId, Guid venueId, string requestedByUserId,
        string title, string? description, DateTimeOffset startUtc, DateTimeOffset endUtc,
        int expectedAttendees, Guid workflowDefinitionId, Guid initialStateId)
    {
        if (endUtc <= startUtc)
            throw new DomainException("The reservation must end after it starts.");

        return new Reservation
        {
            OrgId = orgId,
            ParishId = parishId,
            GroupId = Guard.NotEmpty(groupId, "GroupId"),
            VenueId = Guard.NotEmpty(venueId, "VenueId"),
            RequestedByUserId = Guard.Required(requestedByUserId, "RequestedByUserId", 450),
            Title = Guard.Required(title, "Title", 300),
            Description = Guard.Optional(description, "Description", 4000),
            StartUtc = startUtc,
            EndUtc = endUtc,
            ExpectedAttendees = Guard.Positive(expectedAttendees, "ExpectedAttendees"),
            WorkflowDefinitionId = Guard.NotEmpty(workflowDefinitionId, "WorkflowDefinitionId"),
            CurrentStateId = Guard.NotEmpty(initialStateId, "InitialStateId")
        };
    }

    /// <summary>
    /// Applies a workflow transition (already looked up by the caller). Enforces that it starts from the
    /// current state and that a note is present when required, advances the state, and returns the
    /// history record for the caller to persist.
    /// </summary>
    public ReservationStateHistory ApplyTransition(WorkflowTransition transition, string actorUserId, string? note)
    {
        if (transition.FromStateId != CurrentStateId)
            throw new DomainException("That action is not available from the current status.");

        if (transition.RequiresNote && string.IsNullOrWhiteSpace(note))
            throw new DomainException($"A note is required to {transition.ActionName.ToLowerInvariant()}.");

        var history = ReservationStateHistory.Record(
            Id, CurrentStateId, transition.ToStateId, transition.ActionCode, actorUserId, note, OrgId, ParishId);

        CurrentStateId = transition.ToStateId;
        return history;
    }
}
