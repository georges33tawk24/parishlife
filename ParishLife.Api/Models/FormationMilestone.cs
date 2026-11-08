// Purpose: represents formation milestone business state and rules.
// Main members: Id, Title, PrerequisiteIds.

namespace ParishLife.Api.Models;

public class FormationMilestone
{
    public string Id { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string[] PrerequisiteIds { get; set; } = Array.Empty<string>();
}
