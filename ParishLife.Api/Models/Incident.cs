// Purpose: represents a restricted incident record; the initial report is protected at rest and never rewritten, later changes are attributed entries.
// Main members: Id, ParishId, EventId, Location, PersonIds, OccurredAt, RecordedAt, RecordedBy, Urgent, Status, HandlerAccountId, ProtectedReport and Entries.

namespace ParishLife.Api.Models;

public class Incident
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string? EventId { get; set; }

    public string? Location { get; set; }

    public string[] PersonIds { get; set; } = Array.Empty<string>();

    public DateTimeOffset OccurredAt { get; set; }

    public DateTimeOffset RecordedAt { get; set; }

    public string RecordedBy { get; set; } = string.Empty;

    public bool Urgent { get; set; }

    public string Status { get; set; } = "Recorded";

    public string? HandlerAccountId { get; set; }

    public string ProtectedReport { get; set; } = string.Empty;

    public List<IncidentEntry> Entries { get; set; } = new();
}
