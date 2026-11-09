// Purpose: returns one neutral attendance row without private review evidence or unrelated personal fields.
// Main members: MeetingId, PersonId, ParticipantKind, Status, RecordedAt.

namespace ParishLife.Api.DTOs.Ministries;

public class AttendanceValueDto
{
    public string MeetingId { get; set; } = string.Empty;

    public string PersonId { get; set; } = string.Empty;

    public string ParticipantKind { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public DateTimeOffset? RecordedAt { get; set; }
}
