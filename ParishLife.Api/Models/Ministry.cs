// Purpose: stores parish-owned ministry lifecycle facts; approval, publication and application intake remain distinct.
// Main members: Id, ParishId, Name/NameAr, Kind, Purpose/PurposeAr, PublicInformation/PublicInformationAr, MeetingTimes/MeetingTimesAr, ApplicationsOpen, Status, PublicListed, EligibilityPolicyReference, PolicyRevision, CreatedBy, CreatedAt, ApprovedBy, ApprovedAt, PublishedBy, PublishedAt.

namespace ParishLife.Api.Models;

public class Ministry
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    // Optional Arabic twin typed by the parish; never translated from Name.
    public string? NameAr { get; set; }

    public string Kind { get; set; } = string.Empty;

    public string Purpose { get; set; } = string.Empty;

    public string? PurposeAr { get; set; }

    public string? PublicInformation { get; set; }

    public string? PublicInformationAr { get; set; }

    // Free-text description of when the group usually meets; operational, not part of the approved description.
    public string? MeetingTimes { get; set; }

    public string? MeetingTimesAr { get; set; }

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
