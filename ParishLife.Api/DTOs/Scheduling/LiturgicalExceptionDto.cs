// Purpose: the parish clergy view of one recorded parish liturgical exception.
// Main members: Id, CalendarId, EffectiveFrom, EffectiveTo, Titles, Reason, Status, RecordedBy/At and WithdrawnReason.

namespace ParishLife.Api.DTOs.Scheduling;

public class LiturgicalExceptionDto
{
    public string Id { get; set; } = string.Empty;

    public string CalendarId { get; set; } = string.Empty;

    public DateOnly EffectiveFrom { get; set; }

    public DateOnly EffectiveTo { get; set; }

    public Dictionary<string, string> Titles { get; set; } = new();

    public string Reason { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public string RecordedBy { get; set; } = string.Empty;

    public DateTimeOffset RecordedAt { get; set; }

    public string? WithdrawnReason { get; set; } = null;
}
