// Purpose: returns only explicitly published public occurrence fields without account or private source identifiers.
// Main members: Status, Id, ParishId, Title, Kind, StartsAt, EndsAt and safe public description/time-zone values.

namespace ParishLife.Api.DTOs.Scheduling;

public class PublicCalendarEventDto
{
    public string Status { get; set; } = string.Empty;

    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string Kind { get; set; } = string.Empty;

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset EndsAt { get; set; }

    public string TimeZone { get; set; } = string.Empty;

    public string? Description { get; set; }
}
