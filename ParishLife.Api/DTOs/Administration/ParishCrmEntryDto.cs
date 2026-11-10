// Purpose: returns an authorized CRM history entry with its preserved snapshots, reason and sanitized manual note.
// Main members: Id, ParishId, Kind, By, At, OccurredAt, Previous, Current, Reason and Text.

namespace ParishLife.Api.DTOs.Administration;

public class ParishCrmEntryDto
{
    public string Id { get; set; } = string.Empty;
    public string ParishId { get; set; } = string.Empty;
    public string Kind { get; set; } = string.Empty;
    public string By { get; set; } = string.Empty;
    public DateTimeOffset At { get; set; }
    public DateTimeOffset? OccurredAt { get; set; } = null;
    public ParishCrmDto? Previous { get; set; } = null;
    public ParishCrmDto Current { get; set; } = new();
    public string? Reason { get; set; } = null;
    public string? Text { get; set; } = null;
}
