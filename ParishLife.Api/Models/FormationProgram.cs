// Purpose: represents formation program business state and rules.
// Main members: Id, MinistryId, Title, Milestones, Status, CreatedBy, ApprovedBy.

namespace ParishLife.Api.Models;

public class FormationProgram
{
    public string Id { get; set; } = string.Empty;

    public string MinistryId { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public FormationMilestone[] Milestones { get; set; } = Array.Empty<FormationMilestone>();

    public string Status { get; set; } = string.Empty;

    public string CreatedBy { get; set; } = string.Empty;

    public string? ApprovedBy { get; set; } = null;
}
