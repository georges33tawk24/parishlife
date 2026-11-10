// Purpose: one dated item on a personal or priest schedule, labelled with its owning parish.
// Main members: ParishId, ParishName, Kind, SourceId, Title, StartsAt, EndsAt, TimeZone, Location and Status.

namespace ParishLife.Api.DTOs.Scheduling;

public class ScheduleItemDto
{
    public string ParishId { get; set; } = string.Empty;

    public string ParishName { get; set; } = string.Empty;

    public string Kind { get; set; } = string.Empty;

    public string SourceId { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset? EndsAt { get; set; }

    public string? TimeZone { get; set; }

    public string? Location { get; set; }

    public string Status { get; set; } = string.Empty;
}
