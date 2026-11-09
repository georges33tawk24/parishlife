// Purpose: preserves attributed attendance old/new states, counters and protected review evidence without general audit text.
// Main members: Id, ParishId, MinistryId, MeetingId, Action, PersonId, PreviousStatus, NewStatus, ActorId, ActingAppointmentId, RecordedAt, ProtectedReason, ProtectedReference, ExpectedCount, PresentCount, LateCount, AbsentCount, ExcusedCount, NotExpectedCount, NotRecordedCount.

namespace ParishLife.Api.Models;

public class AttendanceChange
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string MinistryId { get; set; } = string.Empty;

    public string MeetingId { get; set; } = string.Empty;

    public string Action { get; set; } = string.Empty;

    public string? PersonId { get; set; }

    public string? PreviousStatus { get; set; }

    public string NewStatus { get; set; } = string.Empty;

    public string ActorId { get; set; } = string.Empty;

    public string? ActingAppointmentId { get; set; }

    public DateTimeOffset RecordedAt { get; set; }

    public string? ProtectedReason { get; set; }

    public string? ProtectedReference { get; set; }

    public int ExpectedCount { get; set; }

    public int PresentCount { get; set; }

    public int LateCount { get; set; }

    public int AbsentCount { get; set; }

    public int ExcusedCount { get; set; }

    public int NotExpectedCount { get; set; }

    public int NotRecordedCount { get; set; }
}
