// Purpose: returns an authorized calendar occurrence or a redacted busy interval.
// Main members: Id, ParishId, Title, Kind, StartsAt, EndsAt, TimeZone and related workflow values.

namespace ParishLife.Api.DTOs.Scheduling;

public class CalendarEventDto
{
    public string? LastActionReason { get; set; }

    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string Kind { get; set; } = string.Empty;

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset EndsAt { get; set; }

    public string TimeZone { get; set; } = string.Empty;

    public string Visibility { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public bool Published { get; set; }

    public bool Redacted { get; set; }

    public string? CreatedBy { get; set; }

    public string? SeriesId { get; set; }

    public string? Description { get; set; }
}
