// Purpose: represents actual volunteer hours submitted for one assignment and their independent review.
// Main members: Id, ParishId, MinistryId, PersonId, AssignmentId, actual times, BreakMinutes, EvidenceReference, Status, submitter/reviewer and original submitted values.

namespace ParishLife.Api.Models;

public class VolunteerHours
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string MinistryId { get; set; } = string.Empty;

    public string PersonId { get; set; } = string.Empty;

    public string AssignmentId { get; set; } = string.Empty;

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset EndsAt { get; set; }

    public int BreakMinutes { get; set; }

    public string? EvidenceReference { get; set; } = null;

    // Submitted, Verified or Rejected.
    public string Status { get; set; } = "Submitted";

    public string SubmittedBy { get; set; } = string.Empty;

    public DateTimeOffset SubmittedAt { get; set; }

    public string? ReviewedBy { get; set; } = null;

    public DateTimeOffset? ReviewedAt { get; set; } = null;

    public string? ReviewReason { get; set; } = null;

    // The submitted values are kept when a reviewer corrects them.
    public DateTimeOffset? OriginalStartsAt { get; set; } = null;

    public DateTimeOffset? OriginalEndsAt { get; set; } = null;

    public int? OriginalBreakMinutes { get; set; } = null;
}
