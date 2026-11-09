// Purpose: exposes authorized leadership history separately from ordinary current-leader summaries.
// Main members: Id, Action, RecordedBy, RecordedAt and the historical Appointment projection.

namespace ParishLife.Api.DTOs.Ministries;

public class MinistryLeadershipHistoryDto
{
    public string Id { get; set; } = string.Empty;

    public string Action { get; set; } = string.Empty;

    public string RecordedBy { get; set; } = string.Empty;

    public DateTimeOffset RecordedAt { get; set; }

    public string? EvidenceReference { get; set; }

    public string? Reason { get; set; }

    public MinistryLeaderDto Appointment { get; set; } = new();
}
