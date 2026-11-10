// Purpose: returns one append-only formation change, including the milestone state before and after it.
// Main members: Id, EnrollmentId, MilestoneKey, Action, FromStatus, ToStatus, RecordedBy, RecordedAt, Reason, Previous and Current.

namespace ParishLife.Api.DTOs.Ministries;

public class FormationHistoryDto
{
    public string Id { get; set; } = string.Empty;

    public string EnrollmentId { get; set; } = string.Empty;

    public string? MilestoneKey { get; set; } = null;

    public string Action { get; set; } = string.Empty;

    public string FromStatus { get; set; } = string.Empty;

    public string ToStatus { get; set; } = string.Empty;

    public string RecordedBy { get; set; } = string.Empty;

    public DateTimeOffset RecordedAt { get; set; }

    public string? Reason { get; set; } = null;

    public FormationMilestoneProgressDto? Previous { get; set; } = null;

    public FormationMilestoneProgressDto? Current { get; set; } = null;
}
