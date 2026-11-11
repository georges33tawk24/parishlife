// Purpose: a parish's local observance recorded by an appointed priest under an approved calendar that permits parish exceptions. It keeps its
// reason and effective dates and stays distinguishable from the authority's calendar facts.
// Main members: Id, ParishId, ArchdioceseId, CalendarId, EffectiveFrom/EffectiveTo, Titles, Reason, Status (Active, Withdrawn) and history.

namespace ParishLife.Api.Models;

public class LiturgicalException
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string ArchdioceseId { get; set; } = string.Empty;

    public string CalendarId { get; set; } = string.Empty;

    public DateOnly EffectiveFrom { get; set; }

    public DateOnly EffectiveTo { get; set; }

    public Dictionary<string, string> Titles { get; set; } = [];

    public string Reason { get; set; } = string.Empty;

    public string Status { get; set; } = "Active";

    public string RecordedBy { get; set; } = string.Empty;

    public DateTimeOffset RecordedAt { get; set; }

    public string? WithdrawnBy { get; set; } = null;

    public DateTimeOffset? WithdrawnAt { get; set; } = null;

    public string? WithdrawnReason { get; set; } = null;
}
