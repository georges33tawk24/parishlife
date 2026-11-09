// Purpose: stores parish-owned ministry lifecycle facts; approval, publication and application intake remain distinct.
// Main members: Id, ParishId, Name, Kind, Purpose, PublicInformation, ApplicationsOpen, Status, PublicListed, EligibilityPolicyReference, PolicyRevision, CreatedBy, CreatedAt, ApprovedBy, ApprovedAt, PublishedBy, PublishedAt.

namespace ParishLife.Api.Models;

public class Ministry
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

    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public string? ApprovedBy { get; set; }

    public DateTimeOffset? ApprovedAt { get; set; }

    public string? PublishedBy { get; set; }

    public DateTimeOffset? PublishedAt { get; set; }
}
