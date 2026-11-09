// Purpose: coordinates a resumable occurrence-date member snapshot, separate recorded guest counters and attributed reporting closure.
// Main members: occurrence/scope identity, resumable snapshot state, member counters, optional GuestCounts and protected reporting-closure evidence.

namespace ParishLife.Api.Models;

public class AttendanceSheet
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string MinistryId { get; set; } = string.Empty;

    public string MeetingId { get; set; } = string.Empty;

    public string EventId { get; set; } = string.Empty;

    public DateTimeOffset MeetingStartsAt { get; set; }

    public DateTimeOffset MeetingEndsAt { get; set; }

    public string TimeZone { get; set; } = string.Empty;

    public string Status { get; set; } = "Building";

    public string SnapshotPhase { get; set; } = "MembershipValidation";

    public string? SnapshotCursor { get; set; }

    public int SnapshotPages { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset? SnapshotCompletedAt { get; set; }

    public string MetricDefinition { get; set; } = "proposed-present-plus-late-v1";

    public int ExpectedCount { get; set; }

    public int PresentCount { get; set; }

    public int LateCount { get; set; }

    public int AbsentCount { get; set; }

    public int ExcusedCount { get; set; }

    public int NotExpectedCount { get; set; }

    public int NotRecordedCount { get; set; }

    public AttendanceGuestCounts? GuestCounts { get; set; }

    public DateTimeOffset? ClosedAt { get; set; }

    public string? ClosedBy { get; set; }

    public string? ProtectedReportingReference { get; set; }

    public string? ProtectedCloseReason { get; set; }
}
