// Purpose: a delivered report run; Counts are filled only on detail reads and only for queues the reader can still see.
// Main members: Id, ScheduleId, Report, ParishId, ScheduledFor, ProducedAt, Status, ExternalChannel, ExternalStatus, Counts.

namespace ParishLife.Api.DTOs.Reporting;

public class ReportDeliveryDto
{
    public string Id { get; set; } = string.Empty;

    public string ScheduleId { get; set; } = string.Empty;

    public string Report { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public DateTimeOffset ScheduledFor { get; set; }

    public DateTimeOffset ProducedAt { get; set; }

    public string Status { get; set; } = string.Empty;

    public string? ExternalChannel { get; set; } = null;

    public string? ExternalStatus { get; set; } = null;

    public WorkCountDto[] Counts { get; set; } = Array.Empty<WorkCountDto>();
}
