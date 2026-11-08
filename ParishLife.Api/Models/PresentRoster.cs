// Purpose: represents present roster business state and rules.
// Main members: EventId, AsOf, Coverage, Entries.

namespace ParishLife.Api.Models;

public class PresentRoster
{
    public string EventId { get; set; } = string.Empty;

    public DateTimeOffset AsOf { get; set; }

    public string Coverage { get; set; } = string.Empty;

    public RosterEntry[] Entries { get; set; } = Array.Empty<RosterEntry>();
}
