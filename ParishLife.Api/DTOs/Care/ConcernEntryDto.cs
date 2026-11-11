// Purpose: returns one concern entry; submitters never receive reviewer-only notes or reviewer identities.
// Main members: Id, Kind, Body, FromReviewer, At and the posting reviewer's NotificationOutcome.

using ParishLife.Api.DTOs.Communications;

namespace ParishLife.Api.DTOs.Care;

public class ConcernEntryDto
{
    public string Id { get; set; } = string.Empty;

    public string Kind { get; set; } = string.Empty;

    public string Body { get; set; } = string.Empty;

    public bool FromReviewer { get; set; }

    public DateTimeOffset At { get; set; }

    // Loaded only in a reviewer's own post response; submitters and entry lists never receive it.
    public NotificationOutcomeDto? NotificationOutcome { get; set; } = null;
}
