// Purpose: returns a formation enrollment with its pinned program revision, milestone progress and a fixed output label.
// Main members: Id, MinistryId, ProgramId, ProgramTitle, ProgramRevision, PersonId, Status, dates, Milestones and OutputLabel.

namespace ParishLife.Api.DTOs.Ministries;

public class FormationEnrollmentDto
{
    public string Id { get; set; } = string.Empty;

    public string MinistryId { get; set; } = string.Empty;

    public string ProgramId { get; set; } = string.Empty;

    public string ProgramTitle { get; set; } = string.Empty;

    public int ProgramRevision { get; set; }

    public string PersonId { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public DateTimeOffset EnrolledAt { get; set; }

    public string? EnrolledBy { get; set; } = null;

    public DateTimeOffset? CompletedAt { get; set; } = null;

    public DateTimeOffset? WithdrawnAt { get; set; } = null;

    public string? WithdrawalReason { get; set; } = null;

    public FormationMilestoneProgressDto[] Milestones { get; set; } = Array.Empty<FormationMilestoneProgressDto>();

    // Completion is a group formation record; it is never a sacramental certificate or eligibility decision.
    public string OutputLabel { get; set; } = "Ministry formation record; not a sacramental certificate or eligibility decision.";
}
