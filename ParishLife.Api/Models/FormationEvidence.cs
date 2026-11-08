// Purpose: represents formation evidence business state and rules.
// Main members: Id, MinistryId, ProgramId, PersonId, MilestoneId, EvidenceReference, AchievedAt, and related workflow details.

namespace ParishLife.Api.Models;

public class FormationEvidence
{
    public string Id { get; set; } = string.Empty;

    public string MinistryId { get; set; } = string.Empty;

    public string ProgramId { get; set; } = string.Empty;

    public string PersonId { get; set; } = string.Empty;

    public string MilestoneId { get; set; } = string.Empty;

    public string EvidenceReference { get; set; } = string.Empty;

    public DateTimeOffset AchievedAt { get; set; }

    public string RecordedBy { get; set; } = string.Empty;
}
