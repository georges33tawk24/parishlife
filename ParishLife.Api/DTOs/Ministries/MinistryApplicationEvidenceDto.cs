// Purpose: exposes actual application provenance only to the authorized parish priest reviewing the case.
// Main members: source/preparer/reviewer identities, reviewed policy revision and protected evidence references after authorized decryption.

namespace ParishLife.Api.DTOs.Ministries;

public class MinistryApplicationEvidenceDto
{
    public string ApplicationId { get; set; } = string.Empty;
    public string PreparedBy { get; set; } = string.Empty;
    public string? ApplicantAccountId { get; set; }
    public string? ReviewedBy { get; set; }
    public string? DecidedBy { get; set; }
    public int PolicyRevision { get; set; }
    public string? RepresentationEvidence { get; set; }
    public string? EligibilityReviewReference { get; set; }
}
