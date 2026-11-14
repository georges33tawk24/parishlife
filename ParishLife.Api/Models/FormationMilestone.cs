// Purpose: represents one milestone definition inside a formation program revision.
// Main members: Key, Title/TitleAr, Description/DescriptionAr, PrerequisiteKeys and ClergyApproval, which requires a priest to record completion.

namespace ParishLife.Api.Models;

public class FormationMilestone
{
    public string Key { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string? TitleAr { get; set; } = null;

    // Optional learning goal shown with the milestone.
    public string? Description { get; set; } = null;

    public string? DescriptionAr { get; set; } = null;

    public string[] PrerequisiteKeys { get; set; } = Array.Empty<string>();

    public bool ClergyApproval { get; set; }
}
