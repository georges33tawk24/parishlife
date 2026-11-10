// Purpose: retains an immutable, attributed CRM change or sanitized manual note with original snapshots and protected text.
// Main members: Id, ParishId, Kind, By, At, OccurredAt, Previous, Current, ProtectedReason and ProtectedText.

namespace ParishLife.Api.Models;

public class ParishCrmEntry
{
    public string Id { get; set; } = string.Empty;
    public string ParishId { get; set; } = string.Empty;
    public string Kind { get; set; } = string.Empty;
    public string By { get; set; } = string.Empty;
    public DateTimeOffset At { get; set; }
    public DateTimeOffset? OccurredAt { get; set; } = null;
    public ParishCrmRecord? Previous { get; set; } = null;
    public ParishCrmRecord Current { get; set; } = new();
    public string? ProtectedReason { get; set; } = null;
    public string? ProtectedText { get; set; } = null;
}
