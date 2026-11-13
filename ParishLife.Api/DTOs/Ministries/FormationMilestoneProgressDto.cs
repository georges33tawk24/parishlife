// Purpose: returns one milestone's progress; staff projections include evidence and actors, own projections omit them.
// Main members: Key, Title/TitleAr, ClergyApproval, Status, ResumeStatus, evidence/source facts, AchievedOn, actors and ApplicantExplanation.

namespace ParishLife.Api.DTOs.Ministries;

public class FormationMilestoneProgressDto
{
    public string Key { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string? TitleAr { get; set; } = null;

    public bool ClergyApproval { get; set; }

    public string Status { get; set; } = string.Empty;

    public string? ResumeStatus { get; set; } = null;

    public string? EvidenceReference { get; set; } = null;

    public string? Source { get; set; } = null;

    public string? ExternalProvenance { get; set; } = null;

    public DateOnly? AchievedOn { get; set; } = null;

    public string? RecordedBy { get; set; } = null;

    public string? ReviewedBy { get; set; } = null;

    public string? ReviewReference { get; set; } = null;

    public string? CompletedBy { get; set; } = null;

    public DateTimeOffset? CompletedAt { get; set; } = null;

    public string? ApplicantExplanation { get; set; } = null;
}
