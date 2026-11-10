// Purpose: input/output shape of a custom workflow's form and steps (draft or published version).
// Main members: StartPermission, Fields (the shared versioned form-field model with conditional show/require rules),
// RestrictedFieldKeys (fields whose answers only the process owner, starter and restricted-reader steps may see) and Steps.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Models;

namespace ParishLife.Api.DTOs.Workflows;

public class WorkflowTemplateDto
{
    [Required, StringLength(80)]
    public string StartPermission { get; set; } = string.Empty;

    [Required, MaxLength(40)]
    public RegistrationField[] Fields { get; set; } = Array.Empty<RegistrationField>();

    [Required, MaxLength(40)]
    public string[] RestrictedFieldKeys { get; set; } = Array.Empty<string>();

    [Required, MinLength(1), MaxLength(20)]
    public WorkflowStepDto[] Steps { get; set; } = Array.Empty<WorkflowStepDto>();
}
