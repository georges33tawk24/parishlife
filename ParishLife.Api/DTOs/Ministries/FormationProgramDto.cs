// Purpose: returns a formation program revision without private approval references unless the reader is privileged.
// Main members: Id, MinistryId, Title/TitleAr, Revision, SupersedesProgramId, Status, Milestones and creation/approval/retirement facts.

namespace ParishLife.Api.DTOs.Ministries;

public class FormationProgramDto
{
    public string Id { get; set; } = string.Empty;

    public string MinistryId { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string? TitleAr { get; set; } = null;

    public int Revision { get; set; }

    public string? SupersedesProgramId { get; set; } = null;

    public string Status { get; set; } = string.Empty;

    public FormationMilestoneDto[] Milestones { get; set; } = Array.Empty<FormationMilestoneDto>();

    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public string? ApprovedBy { get; set; } = null;

    public DateTimeOffset? ApprovedAt { get; set; } = null;

    public string? ApprovalReference { get; set; } = null;

    public DateTimeOffset? RetiredAt { get; set; } = null;

    public string? RetirementReason { get; set; } = null;
}
