// Purpose: one entry of a reservation's decision history: the request, each office decision and each allocation outcome.
// Main members: Action, ActorId, At and Reason.

namespace ParishLife.Api.Models;

public class ReservationDecision
{
    // request, confirm, decline, cancel, or the worker outcome confirmed, conflict or cancelled.
    public string Action { get; set; } = string.Empty;

    // The deciding account, or "system" for an allocation outcome.
    public string ActorId { get; set; } = string.Empty;

    public DateTimeOffset At { get; set; }

    public string? Reason { get; set; } = null;
}
