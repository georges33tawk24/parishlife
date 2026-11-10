// Purpose: creates a new parish custom workflow definition with its first working draft.
// Main members: OperationId, Title and Template.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Workflows;

public class CreateWorkflowDefinitionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required, StringLength(200)]
    public string Title { get; set; } = string.Empty;

    [Required]
    public WorkflowTemplateDto Template { get; set; } = new();
}
