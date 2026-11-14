// Purpose: returns one entry of a reservation's decision history.
// Main members: Action, ActorId, At and Reason.

namespace ParishLife.Api.DTOs.Scheduling;

public class ReservationDecisionDto
{
    public string Action { get; set; } = string.Empty;

    public string ActorId { get; set; } = string.Empty;

    public DateTimeOffset At { get; set; }

    public string? Reason { get; set; } = null;
}
