// Purpose: one ordered step of a custom workflow template; the actor must currently hold Permission in the run's parish.
// Main members: Key, Title, Permission, WhenField/WhenValue (conditional branch on a form answer) and ViewsRestricted.

namespace ParishLife.Api.Models;

public class WorkflowStep
{
    public string Key { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string Permission { get; set; } = string.Empty;

    public string? WhenField { get; set; } = null;

    public string? WhenValue { get; set; } = null;

    public bool ViewsRestricted { get; set; }
}
