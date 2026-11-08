// Purpose: represents facility business state and rules.
// Main members: Id, ParishId, Name, Kind, Capacity, SetupMinutes, CleanupMinutes, and related workflow details.

namespace ParishLife.Api.Models;

public class Facility
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string Kind { get; set; } = string.Empty;

    public int Capacity { get; set; }

    public int SetupMinutes { get; set; }

    public int CleanupMinutes { get; set; }

    public string Status { get; set; } = string.Empty;

    public string[] ExclusionResourceIds { get; set; } = Array.Empty<string>();

    public string? PublicDescription { get; set; } = null;
}
