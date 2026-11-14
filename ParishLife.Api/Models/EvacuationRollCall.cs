// Purpose: an evacuation roll call for one event: a snapshot of the participants recorded present when it started,
// each marked accounted for by an assigned door operator. It records what operators marked, not a building census.
// Main members: Id, ParishId, EventId, Kind (Drill or Emergency), Status (Open or Closed), StartedAt/By, ClosedAt/By, Note and Entries.

namespace ParishLife.Api.Models;

public class EvacuationRollCall
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string EventId { get; set; } = string.Empty;

    public string Kind { get; set; } = string.Empty;

    public string Status { get; set; } = "Open";

    public DateTimeOffset StartedAt { get; set; }

    public string StartedBy { get; set; } = string.Empty;

    public DateTimeOffset? ClosedAt { get; set; } = null;

    public string? ClosedBy { get; set; } = null;

    public string? Note { get; set; } = null;

    public List<EvacuationEntry> Entries { get; set; } = new();
}
