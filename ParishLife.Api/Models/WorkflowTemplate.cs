// Purpose: the editable or published content of a custom workflow: who may start it, its versioned form and its ordered steps.
// Main members: StartPermission, Fields (shared form-field model), RestrictedFieldKeys (privacy class per field) and Steps.

namespace ParishLife.Api.Models;

public class WorkflowTemplate
{
    public string StartPermission { get; set; } = string.Empty;

    public RegistrationField[] Fields { get; set; } = Array.Empty<RegistrationField>();

    public string[] RestrictedFieldKeys { get; set; } = Array.Empty<string>();

    public WorkflowStep[] Steps { get; set; } = Array.Empty<WorkflowStep>();
}
