// Purpose: represents one immutable-once-approved revision of a ministry formation program that enrollments pin.
// Main members: Id, ParishId, MinistryId, Title, Revision, SupersedesProgramId, Milestones, Status and creation/approval/retirement facts.

namespace ParishLife.Api.Models;

public class FormationProgram
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string MinistryId { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public int Revision { get; set; } = 1;

    public string? SupersedesProgramId { get; set; } = null;

    public FormationMilestone[] Milestones { get; set; } = Array.Empty<FormationMilestone>();

    // Draft, Approved, Superseded or Retired. Only Approved revisions accept new enrollments.
    public string Status { get; set; } = "Draft";

    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public string? ApprovedBy { get; set; } = null;

    public DateTimeOffset? ApprovedAt { get; set; } = null;

    public string? ApprovalReference { get; set; } = null;

    public string? RetiredBy { get; set; } = null;

    public DateTimeOffset? RetiredAt { get; set; } = null;

    public string? RetirementReason { get; set; } = null;
}
