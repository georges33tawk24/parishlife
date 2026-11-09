// Purpose: stores a ministry join/departure request separately from its effective roster membership.
// Main members: identity and stage fields, actual review dates, policy revision and protected applicant/evidence text.

namespace ParishLife.Api.Models;

public class MinistryApplication
{
    public string Id { get; set; } = string.Empty;

    public string MinistryId { get; set; } = string.Empty;

    public string PersonId { get; set; } = string.Empty;

    public string? ApplicantAccountId { get; set; }

    public string Kind { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public string SubmittedBy { get; set; } = string.Empty;

    public DateTimeOffset SubmittedAt { get; set; }

    public string? ReviewedBy { get; set; } = null;

    public string? DecidedBy { get; set; } = null;

    public DateTimeOffset? DecidedAt { get; set; } = null;

    public string? ReturnResumeStatus { get; set; }

    public string? PriorStatus { get; set; } = null;

    public DateTimeOffset? ReviewedAt { get; set; }

    public DateTimeOffset? RecommendedAt { get; set; }

    public int PolicyRevision { get; set; }

    public string? ProtectedReason { get; set; }

    public string? ProtectedRepresentationEvidence { get; set; }

    public string? ProtectedEligibilityReviewReference { get; set; }
}
