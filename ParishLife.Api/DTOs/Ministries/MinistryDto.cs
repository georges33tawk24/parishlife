// Purpose: returns authorized ministry setup and lifecycle state without persistence envelopes.
// Main members: Id, ParishId, Name, Kind, Purpose, PublicInformation, ApplicationsOpen, Status, PublicListed, EligibilityPolicyReference, PolicyRevision.

namespace ParishLife.Api.DTOs.Ministries;

public class MinistryDto
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string Kind { get; set; } = string.Empty;

    public string Purpose { get; set; } = string.Empty;

    public string? PublicInformation { get; set; }

    public bool ApplicationsOpen { get; set; }

    public string Status { get; set; } = string.Empty;

    public bool PublicListed { get; set; }

    public string? EligibilityPolicyReference { get; set; }

    public int PolicyRevision { get; set; }
}
