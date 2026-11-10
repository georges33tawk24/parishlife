// Purpose: input/output shape of one ordered custom workflow step.
// Main members: Key, Title, Permission (required of the step actor), optional WhenField/WhenValue branch condition and ViewsRestricted.

using System.ComponentModel.DataAnnotations;

namespace ParishLife.Api.DTOs.Workflows;

public class WorkflowStepDto
{
    [Required, StringLength(60)]
    public string Key { get; set; } = string.Empty;

    [Required, StringLength(200)]
    public string Title { get; set; } = string.Empty;

    [Required, StringLength(80)]
    public string Permission { get; set; } = string.Empty;

    [StringLength(60)]
    public string? WhenField { get; set; } = null;

    [StringLength(200)]
    public string? WhenValue { get; set; } = null;

    public bool ViewsRestricted { get; set; }
}
