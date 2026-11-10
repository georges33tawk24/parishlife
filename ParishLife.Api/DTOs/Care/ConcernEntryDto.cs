// Purpose: returns one concern entry; submitters never receive reviewer-only notes or reviewer identities.
// Main members: Id, Kind, Body, FromReviewer and At.

namespace ParishLife.Api.DTOs.Care;

public class ConcernEntryDto
{
    public string Id { get; set; } = string.Empty;

    public string Kind { get; set; } = string.Empty;

    public string Body { get; set; } = string.Empty;

    public bool FromReviewer { get; set; }

    public DateTimeOffset At { get; set; }
}
