// Purpose: represents one milestone definition inside a formation program revision.
// Main members: Key, Title, PrerequisiteKeys and ClergyApproval, which requires a priest to record completion.

namespace ParishLife.Api.Models;

public class FormationMilestone
{
    public string Key { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string[] PrerequisiteKeys { get; set; } = Array.Empty<string>();

    public bool ClergyApproval { get; set; }
}
