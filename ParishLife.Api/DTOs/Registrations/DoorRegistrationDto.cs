// Purpose: returns a confirmed participant's door workflow details without answers, financial data or private evidence.
// Main members: Id, EventId, DisplayName, Status, Presence, LastPresenceAt, IndependentDeparture, authorized collector names/IDs
// and PickupCodeRequired (a code was issued and must be given at checkout; the code itself is never shown).

namespace ParishLife.Api.DTOs.Registrations;

public class DoorRegistrationDto
{
    public string Id { get; set; } = string.Empty;

    public string EventId { get; set; } = string.Empty;

    public string DisplayName { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public string Presence { get; set; } = string.Empty;

    public DateTimeOffset? LastPresenceAt { get; set; } = null;

    public bool IndependentDeparture { get; set; }

    public DoorCollectorDto[] Collectors { get; set; } = Array.Empty<DoorCollectorDto>();

    public bool PickupCodeRequired { get; set; }
}
