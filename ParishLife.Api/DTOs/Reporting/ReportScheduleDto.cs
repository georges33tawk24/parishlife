// Purpose: the owner's view of a report schedule, including its next run and the honest email state.
// Main members: Id, Report, ParishId, Frequency, DayOfWeek, LocalHour, TimeZone, Status, StatusReason, NextRunAt, LastRunAt, EmailRequested, EmailStatus, CreatedAt.

namespace ParishLife.Api.DTOs.Reporting;

public class ReportScheduleDto
{
    public string Id { get; set; } = string.Empty;

    public string Report { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string Frequency { get; set; } = string.Empty;

    public string? DayOfWeek { get; set; } = null;

    public int LocalHour { get; set; }

    public string TimeZone { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public string? StatusReason { get; set; } = null;

    public DateTimeOffset NextRunAt { get; set; }

    public DateTimeOffset? LastRunAt { get; set; } = null;

    public bool EmailRequested { get; set; }

    public string? EmailStatus { get; set; } = null;

    public DateTimeOffset CreatedAt { get; set; }
}
