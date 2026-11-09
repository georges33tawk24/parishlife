// Purpose: preserves actual meeting lifecycle decisions without copying private group content into the general audit.
// Main members: meeting identity, action, state, actor/capacity, recorded time and operator-only reason.

namespace ParishLife.Api.Models;

public class MinistryMeetingHistory
{
    public string Id { get; set; } = string.Empty;
    public string MinistryId { get; set; } = string.Empty;
    public string MeetingId { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string ActorId { get; set; } = string.Empty;
    public string? ActingAppointmentId { get; set; }
    public DateTimeOffset RecordedAt { get; set; }
    public string? Reason { get; set; }
}
