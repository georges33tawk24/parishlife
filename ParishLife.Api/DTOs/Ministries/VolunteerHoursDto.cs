// Purpose: returns submitted actual hours, their review state and any original values a reviewer corrected.
// Main members: Id, AssignmentId, PersonId, StartsAt, EndsAt, BreakMinutes, Minutes, EvidenceReference, Status, submitter/reviewer facts and originals.

namespace ParishLife.Api.DTOs.Ministries;

public class VolunteerHoursDto
{
    public string Id { get; set; } = string.Empty;

    public string AssignmentId { get; set; } = string.Empty;

    public string PersonId { get; set; } = string.Empty;

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset EndsAt { get; set; }

    public int BreakMinutes { get; set; }

    public int Minutes { get; set; }

    public string? EvidenceReference { get; set; } = null;

    public string Status { get; set; } = string.Empty;

    public string SubmittedBy { get; set; } = string.Empty;

    public DateTimeOffset SubmittedAt { get; set; }

    public string? ReviewedBy { get; set; } = null;

    public DateTimeOffset? ReviewedAt { get; set; } = null;

    public string? ReviewReason { get; set; } = null;

    public DateTimeOffset? OriginalStartsAt { get; set; } = null;

    public DateTimeOffset? OriginalEndsAt { get; set; } = null;

    public int? OriginalBreakMinutes { get; set; } = null;
}
