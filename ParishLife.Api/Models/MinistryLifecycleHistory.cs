// Purpose: preserves restricted ministry lifecycle decisions independently of the current description.
// Main members: Id, MinistryId, Action, Status, ActorId, ActingAppointmentId, At, Reason.

namespace ParishLife.Api.Models;

public class MinistryLifecycleHistory
{
    public string Id { get; set; } = string.Empty;

    public string MinistryId { get; set; } = string.Empty;

    public string Action { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public string ActorId { get; set; } = string.Empty;

    public string? ActingAppointmentId { get; set; }

    public DateTimeOffset At { get; set; }

    public string Reason { get; set; } = string.Empty;
}
