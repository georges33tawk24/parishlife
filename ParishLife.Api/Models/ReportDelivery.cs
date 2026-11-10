// Purpose: one run of a report schedule: the in-app snapshot stored for the recipient (or NotAuthorized without contents) and the honest external channel state.
// Main members: Id, ScheduleId, AccountId, Report, ParishId, ScheduledFor, ProducedAt, Status, ExternalChannel, ExternalStatus, Counts.

namespace ParishLife.Api.Models;

public class ReportDelivery
{
    public string Id { get; set; } = string.Empty;

    public string ScheduleId { get; set; } = string.Empty;

    public string AccountId { get; set; } = string.Empty;

    public string Report { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public DateTimeOffset ScheduledFor { get; set; }

    public DateTimeOffset ProducedAt { get; set; }

    public string Status { get; set; } = string.Empty;

    public string? ExternalChannel { get; set; } = null;

    public string? ExternalStatus { get; set; } = null;

    public List<ReportCount> Counts { get; set; } = new();
}
