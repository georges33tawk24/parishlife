// Purpose: stores one occurrence-date roster member or reviewed guest and explicit attendance independently from RSVP.
// Main members: Id, ParishId, MinistryId, MeetingId, PersonId, MembershipPeriodId, ParticipantKind, Status, RecordedAt, RecordedBy.

namespace ParishLife.Api.Models;

public class AttendanceRow
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string MinistryId { get; set; } = string.Empty;

    public string MeetingId { get; set; } = string.Empty;

    public string PersonId { get; set; } = string.Empty;

    public string MembershipPeriodId { get; set; } = string.Empty;

    public string ParticipantKind { get; set; } = "Member";

    public string Status { get; set; } = "NotRecorded";

    public DateTimeOffset? RecordedAt { get; set; }

    public string? RecordedBy { get; set; }
}
