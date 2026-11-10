// Purpose: represents one parish person's enrollment in one pinned formation program revision of a ministry.
// Main members: Id, ParishId, MinistryId, ProgramId, ProgramRevision, PersonId, Status, enrollment/completion/withdrawal facts and bounded Milestones.

namespace ParishLife.Api.Models;

public class FormationEnrollment
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string MinistryId { get; set; } = string.Empty;

    public string ProgramId { get; set; } = string.Empty;

    public int ProgramRevision { get; set; }

    public string PersonId { get; set; } = string.Empty;

    // Active, Completed or Withdrawn.
    public string Status { get; set; } = "Active";

    public string EnrolledBy { get; set; } = string.Empty;

    public DateTimeOffset EnrolledAt { get; set; }

    public DateTimeOffset? CompletedAt { get; set; } = null;

    public string? WithdrawnBy { get; set; } = null;

    public DateTimeOffset? WithdrawnAt { get; set; } = null;

    public string? WithdrawalReason { get; set; } = null;

    public FormationMilestoneProgress[] Milestones { get; set; } = Array.Empty<FormationMilestoneProgress>();
}
