// Purpose: retains each explicit change to the head designation without rewriting the underlying priest appointment.
// Main members: Id, AppointmentId, ParishId, PreviousStartsAt, PreviousEndsAt, NewStartsAt, NewEndsAt and related workflow state.

namespace ParishLife.Api.Models;

public class HeadDesignationChange
{

    public string Id { get; set; } = string.Empty;

    public string AppointmentId { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public DateTimeOffset? PreviousStartsAt { get; set; }

    public DateTimeOffset? PreviousEndsAt { get; set; }

    public DateTimeOffset? NewStartsAt { get; set; }

    public DateTimeOffset? NewEndsAt { get; set; }

    public string Reason { get; set; } = string.Empty;

    public string EvidenceReference { get; set; } = string.Empty;

    public string RecordedBy { get; set; } = string.Empty;

    public DateTimeOffset RecordedAt { get; set; }
}
