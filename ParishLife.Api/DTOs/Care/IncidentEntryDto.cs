// Purpose: shows one attributed incident entry to an authorized handler.
// Main members: Kind, Action, Field, PersonId, Text, By and At.

namespace ParishLife.Api.DTOs.Care;

public class IncidentEntryDto
{
    public string Kind { get; set; } = string.Empty;

    public string Action { get; set; } = string.Empty;

    public string? Field { get; set; }

    public string? PersonId { get; set; }

    public string? Text { get; set; }

    public string By { get; set; } = string.Empty;

    public DateTimeOffset At { get; set; }
}
