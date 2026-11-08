// Purpose: represents attendance record business state and rules.
// Main members: Id, MinistryId, MeetingId, PersonId, Status, RecordedBy, RecordedAt, and related workflow details.

namespace ParishLife.Api.Models;

public class AttendanceRecord
{
    public string Id { get; set; } = string.Empty;

    public string MinistryId { get; set; } = string.Empty;

    public string MeetingId { get; set; } = string.Empty;

    public string PersonId { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public string RecordedBy { get; set; } = string.Empty;

    public DateTimeOffset RecordedAt { get; set; }

    public string? EvidenceReference { get; set; }
}
