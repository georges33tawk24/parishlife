// Purpose: retains completed appointment reviews separately from their next due date and appointment end.
// Main members: Id, AppointmentId, ReviewedBy, ReviewedAt, Reason, PreviousDueAt, NewDueAt.

namespace ParishLife.Api.Models;

public class StaffAppointmentReview
{

    public string Id { get; set; } = string.Empty;

    public string AppointmentId { get; set; } = string.Empty;

    public string ReviewedBy { get; set; } = string.Empty;

    public DateTimeOffset ReviewedAt { get; set; }

    public string Reason { get; set; } = string.Empty;

    public DateTimeOffset? PreviousDueAt { get; set; }

    public DateTimeOffset? NewDueAt { get; set; }
}
