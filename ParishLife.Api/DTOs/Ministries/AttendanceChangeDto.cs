// Purpose: returns attendance history only to an explicitly authorized reviewer, including decrypted purpose-scoped evidence.
// Main members: occurrence/person/participant kind, attributed old/new states, protected review text and separate member/guest counter snapshots.

namespace ParishLife.Api.DTOs.Ministries;

public class AttendanceChangeDto
{
    public string Id { get; set; } = string.Empty;

    public string MeetingId { get; set; } = string.Empty;

    public string Action { get; set; } = string.Empty;

    public string? PersonId { get; set; }

    public string? ParticipantKind { get; set; }

    public AttendanceGuestCountsDto? GuestCounts { get; set; }

    public string? PreviousStatus { get; set; }

    public string NewStatus { get; set; } = string.Empty;

    public string ActorId { get; set; } = string.Empty;

    public string? ActingAppointmentId { get; set; }

    public DateTimeOffset RecordedAt { get; set; }

    public string? Reason { get; set; }

    public string? ReviewReference { get; set; }

    public int ExpectedCount { get; set; }

    public int PresentCount { get; set; }

    public int LateCount { get; set; }

    public int AbsentCount { get; set; }

    public int ExcusedCount { get; set; }

    public int NotExpectedCount { get; set; }

    public int NotRecordedCount { get; set; }
}
