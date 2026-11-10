// Purpose: an account's own schedule for delivering a report snapshot in-app; email is recorded only as requested and never claimed as sent.
// Main members: Id, AccountId, Report, ParishId, Frequency, DayOfWeek, LocalHour, TimeZone, EmailRequested, Status, StatusReason, NextRunAt, LastRunAt, CreatedAt, UpdatedAt.

namespace ParishLife.Api.Models;

public class ReportSchedule
{
    public string Id { get; set; } = string.Empty;

    public string AccountId { get; set; } = string.Empty;

    public string Report { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string Frequency { get; set; } = string.Empty;

    public string? DayOfWeek { get; set; } = null;

    public int LocalHour { get; set; }

    public string TimeZone { get; set; } = string.Empty;

    public bool EmailRequested { get; set; }

    public string Status { get; set; } = "Active";

    public string? StatusReason { get; set; } = null;

    public DateTimeOffset NextRunAt { get; set; }

    public DateTimeOffset? LastRunAt { get; set; } = null;

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}
