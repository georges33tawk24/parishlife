// Purpose: presents an authorized applicant or reviewer with the actual application stage and safe explanation.
// Main members: request/person identity, stage, review dates, next owner and applicant-visible reason; no private evidence or account credentials.

namespace ParishLife.Api.DTOs.Ministries;

public class MinistryApplicationDto
{
    public string Id { get; set; } = string.Empty;
    public string MinistryId { get; set; } = string.Empty;
    public string PersonId { get; set; } = string.Empty;
    public string Kind { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTimeOffset SubmittedAt { get; set; }
    public DateTimeOffset? ReviewedAt { get; set; }
    public DateTimeOffset? RecommendedAt { get; set; }
    public DateTimeOffset? DecidedAt { get; set; }
    public string NextOwner { get; set; } = string.Empty;
    public string? Reason { get; set; }
}
