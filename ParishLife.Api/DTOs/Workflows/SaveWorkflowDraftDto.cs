// Purpose: replaces the working draft of a custom workflow; published versions and running cases are unaffected.
// Main members: OperationId, Version (current definition ETag), Title and Template.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Workflows;

public class SaveWorkflowDraftDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required, StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required, StringLength(200)]
    public string Title { get; set; } = string.Empty;

    [Required]
    public WorkflowTemplateDto Template { get; set; } = new();
}
