// Purpose: represents a member's proposed corrections to their own official Person record, reviewed field by field.
// Main members: Id, ParishId, ApplicantAccountId, PersonId, Fields, Status, ReviewedBy, dates and latest notification-work pointers.

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

    // Null preserves the distinction between historical unknown tracking and no required notice.
    public List<string>? NotificationWorkIds { get; set; } = null;
}
