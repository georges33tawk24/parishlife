// Purpose: one attributed incident entry: a lifecycle step, an amendment, a reviewer-only note or a record of a guardian/subject communication.
// Main members: Kind, Action, Field, PersonId, ProtectedText, By and At.

namespace ParishLife.Api.Models;

public class IncidentEntry
{
    public string Kind { get; set; } = string.Empty;

    public string Action { get; set; } = string.Empty;

    public string? Field { get; set; }

    public string? PersonId { get; set; }

    public string? ProtectedText { get; set; }

    public string By { get; set; } = string.Empty;

    public DateTimeOffset At { get; set; }
}
