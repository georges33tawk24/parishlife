// Purpose: preserves each committed ministry application transition without exposing private text to general audit.
// Main members: application identity, previous/resulting stage, actual actor/time and protected reason/evidence snapshots.

namespace ParishLife.Api.Models;

public class MinistryApplicationHistory
{
    public string Id { get; set; } = string.Empty;
    public string MinistryId { get; set; } = string.Empty;
    public string ApplicationId { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string? PreviousStatus { get; set; }
    public string Status { get; set; } = string.Empty;
    public string ActorId { get; set; } = string.Empty;
    public string? ActingAppointmentId { get; set; }
    public DateTimeOffset RecordedAt { get; set; }
    public string? ProtectedReason { get; set; }
    public string? ProtectedEligibilityReviewReference { get; set; }
}
