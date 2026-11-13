// Purpose: returns one reusable event template of a parish.
// Main members: Id, Name, NameAr, Kind, Visibility, StartTime, DurationMinutes, Description, DescriptionAr, Status, CreatedBy, UpdatedBy and UpdatedAt.

namespace ParishLife.Api.DTOs.Scheduling;

public class EventTemplateDto
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string? NameAr { get; set; } = null;

    public string Kind { get; set; } = string.Empty;

    public string Visibility { get; set; } = string.Empty;

    public string? StartTime { get; set; } = null;

    public int DurationMinutes { get; set; }

    public string? Description { get; set; } = null;

    public string? DescriptionAr { get; set; } = null;

    public string Status { get; set; } = string.Empty;

    public string CreatedBy { get; set; } = string.Empty;

    public string UpdatedBy { get; set; } = string.Empty;

    public DateTimeOffset UpdatedAt { get; set; }
}
