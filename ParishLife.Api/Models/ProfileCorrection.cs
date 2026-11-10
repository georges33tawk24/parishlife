// Purpose: represents a member's proposed corrections to their own official Person record, reviewed field by field.
// Main members: Id, ParishId, ApplicantAccountId, PersonId, Fields, Status, ReviewedBy and dates.

namespace ParishLife.Api.Models;

public class ProfileCorrection
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string ApplicantAccountId { get; set; } = string.Empty;

    public string PersonId { get; set; } = string.Empty;

    public ProfileCorrectionField[] Fields { get; set; } = Array.Empty<ProfileCorrectionField>();

    // Pending, Reviewed or Withdrawn.
    public string Status { get; set; } = "Pending";

    public string? ReviewedBy { get; set; } = null;

    public DateTimeOffset? ReviewedAt { get; set; } = null;

    public DateTimeOffset SubmittedAt { get; set; }
}
