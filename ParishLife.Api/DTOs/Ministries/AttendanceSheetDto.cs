// Purpose: returns honest snapshot/lifecycle and labeled denominator/coverage counts without private reasons or evidence.
// Main members: occurrence/snapshot/lifecycle, expected-member counts and coverage, separate recorded GuestCount/GuestCounts and cancellation state.

namespace ParishLife.Api.DTOs.Ministries;

public class AttendanceSheetDto
{
    public string MeetingId { get; set; } = string.Empty;

    public string MinistryId { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public string SnapshotPhase { get; set; } = string.Empty;

    public int SnapshotPages { get; set; }

    public DateTimeOffset MeetingStartsAt { get; set; }

    public DateTimeOffset MeetingEndsAt { get; set; }

    public string TimeZone { get; set; } = string.Empty;

    public DateTimeOffset? SnapshotCompletedAt { get; set; }

    public DateTimeOffset? ClosedAt { get; set; }

    public string MetricDefinition { get; set; } = string.Empty;

    public int ExpectedCount { get; set; }

    public int PresentCount { get; set; }

    public int LateCount { get; set; }

    public int AbsentCount { get; set; }

    public int ExcusedCount { get; set; }

    public int NotExpectedCount { get; set; }

    public int NotRecordedCount { get; set; }

    public int? GuestCount { get; set; }

    public AttendanceGuestCountsDto? GuestCounts { get; set; }

    public int Denominator { get; set; }

    public int PresentOrLate { get; set; }

    public int RecordedExpected { get; set; }

    public decimal? CoveragePercent { get; set; }

    public decimal? PresentOrLatePercent { get; set; }

    public bool SnapshotComplete { get; set; }

    public bool CancelledOccurrence { get; set; }
}
