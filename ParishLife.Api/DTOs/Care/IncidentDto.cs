// Purpose: shows a restricted incident with its original report and every attributed entry to an authorized handler.
// Main members: Id, EventId, Location, PersonIds, OccurredAt, RecordedAt, RecordedBy, Urgent, Status, HandlerAccountId, report fields and Entries.

namespace ParishLife.Api.DTOs.Care;

public class IncidentDto
{
    public string Id { get; set; } = string.Empty;

    public string? EventId { get; set; }

    public string? Location { get; set; }

    public string[] PersonIds { get; set; } = Array.Empty<string>();

    public DateTimeOffset OccurredAt { get; set; }

    public DateTimeOffset RecordedAt { get; set; }

    public string RecordedBy { get; set; } = string.Empty;

    public bool Urgent { get; set; }

    public string Status { get; set; } = string.Empty;

    public string? HandlerAccountId { get; set; }

    public string Description { get; set; } = string.Empty;

    public string? ImmediateActions { get; set; }

    public string? Witnesses { get; set; }

    public IncidentEntryDto[] Entries { get; set; } = Array.Empty<IncidentEntryDto>();
}
