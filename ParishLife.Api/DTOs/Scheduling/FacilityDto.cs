// Purpose: returns scoped room or space metadata and actual serviceability.
// Main members: Id, ParishId, Name, NameAr, Kind, Capacity, SetupMinutes, CleanupMinutes and related workflow values.

namespace ParishLife.Api.DTOs.Scheduling;

public class FacilityDto
{

    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string? NameAr { get; set; } = null;

    public string Kind { get; set; } = string.Empty;

    public int Capacity { get; set; }

    public int SetupMinutes { get; set; }

    public int CleanupMinutes { get; set; }

    public string Status { get; set; } = string.Empty;

    public string[] ExclusionResourceIds { get; set; } = Array.Empty<string>();

    public string? PublicDescription { get; set; }

    public string? PublicDescriptionAr { get; set; } = null;
}
