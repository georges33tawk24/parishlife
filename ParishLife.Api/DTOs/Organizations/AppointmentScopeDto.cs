// Purpose: returns safe bishop appointment-management scope metadata without exposing representative contact or billing data.
// Main members: ArchdioceseId, ParishId, Name and ParishStatus; the Versioned wrapper carries the current scope ETag.

using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.DTOs.Organizations;

public class AppointmentScopeDto
{
    public string ArchdioceseId { get; set; } = string.Empty;

    public string? ParishId { get; set; }

    public string Name { get; set; } = string.Empty;

    public ParishStatus? ParishStatus { get; set; }
}
