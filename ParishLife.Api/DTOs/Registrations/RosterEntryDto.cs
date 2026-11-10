// Purpose: returns one participant currently recorded as present at an event.
// Main members: RegistrationId, PersonId, DisplayName, Presence and LastPresenceAt.

namespace ParishLife.Api.DTOs.Registrations;

public class RosterEntryDto
{
    public string RegistrationId { get; set; } = string.Empty;

    public string PersonId { get; set; } = string.Empty;

    public string DisplayName { get; set; } = string.Empty;

    public string Presence { get; set; } = string.Empty;

    public DateTimeOffset? LastPresenceAt { get; set; } = null;
}
