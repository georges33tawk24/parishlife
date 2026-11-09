// Purpose: returns explicitly approved public descriptions without roster, account, or internal policy references.
// Main members: Id, ParishId, Name, Kind, Purpose, PublicInformation, ApplicationsOpen.

namespace ParishLife.Api.DTOs.Ministries;

public class PublicMinistryDto
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string Kind { get; set; } = string.Empty;

    public string Purpose { get; set; } = string.Empty;

    public string? PublicInformation { get; set; }

    public bool ApplicationsOpen { get; set; }
}
