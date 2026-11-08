// Purpose: represents roster entry business state and rules.
// Main members: RegistrationId, PersonId, DisplayName, Presence, LastPresenceAt.

namespace ParishLife.Api.Models;

public class RosterEntry
{
    public string RegistrationId { get; set; } = string.Empty;

    public string PersonId { get; set; } = string.Empty;

    public string DisplayName { get; set; } = string.Empty;

    public string Presence { get; set; } = string.Empty;

    public DateTimeOffset? LastPresenceAt { get; set; }
}
