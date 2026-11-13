// Purpose: stores a calendar occurrence, audience, source, publication state, and resource times.
// Main members: Id, ParishId, Title, Kind, StartsAt, EndsAt, TimeZone, and related workflow details; optional Arabic twins TitleAr and DescriptionAr.

namespace ParishLife.Api.Models;

public class CalendarEvent
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string? TitleAr { get; set; } = null;

    public string Kind { get; set; } = string.Empty;

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset EndsAt { get; set; }

    public string TimeZone { get; set; } = string.Empty;

    public string Visibility { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public string CreatedBy { get; set; } = string.Empty;

    public string? MinistryId { get; set; } = null;

    public string? SourceType { get; set; } = null;

    public string? SourceId { get; set; } = null;

    public string? SeriesId { get; set; } = null;

    public bool Published { get; set; } = false;

    public string? Description { get; set; } = null;

    public string? DescriptionAr { get; set; } = null;

    public string[]? ClergyAccountIds { get; set; } = null;

    public string? LastActionReason { get; set; }
}
