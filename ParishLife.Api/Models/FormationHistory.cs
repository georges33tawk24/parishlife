// Purpose: represents one append-only formation change with the milestone state before and after it.
// Main members: Id, MinistryId, PersonId, EnrollmentId, ProgramId, MilestoneKey, Action, FromStatus, ToStatus, actor/time, Reason, Previous and Current.

namespace ParishLife.Api.Models;

public class FormationHistory
{
    public string Id { get; set; } = string.Empty;

    public string MinistryId { get; set; } = string.Empty;

    public string PersonId { get; set; } = string.Empty;

    public string EnrollmentId { get; set; } = string.Empty;

    public string ProgramId { get; set; } = string.Empty;

    public string? MilestoneKey { get; set; } = null;

    public string Action { get; set; } = string.Empty;

    public string FromStatus { get; set; } = string.Empty;

    public string ToStatus { get; set; } = string.Empty;

    public string RecordedBy { get; set; } = string.Empty;

    public DateTimeOffset RecordedAt { get; set; }

    public string? Reason { get; set; } = null;

    public FormationMilestoneProgress? Previous { get; set; } = null;

    public FormationMilestoneProgress? Current { get; set; } = null;
}
