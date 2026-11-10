// Purpose: returns the recorded present-participant roster for one event, with its explicit coverage limits.
// Main members: EventId, AsOf, Coverage and Entries.

namespace ParishLife.Api.DTOs.Registrations;

public class PresentRosterDto
{
    public string EventId { get; set; } = string.Empty;

    public DateTimeOffset AsOf { get; set; }

    public string Coverage { get; set; } = string.Empty;

    public RosterEntryDto[] Entries { get; set; } = Array.Empty<RosterEntryDto>();
}
