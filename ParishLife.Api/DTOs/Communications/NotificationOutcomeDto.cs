// Purpose: reports a source update's notification outcome without exposing recipients, topics, counts or internal work identifiers.
// Main members: Status and user-facing Meaning distinguish tracked confirmation from pending, unnecessary or unavailable notice status.

namespace ParishLife.Api.DTOs.Communications;

public class NotificationOutcomeDto
{
    public string Status { get; set; } = "Unconfirmed";

    public string Meaning { get; set; } = "Notification status could not be confirmed. Check again later.";
}
