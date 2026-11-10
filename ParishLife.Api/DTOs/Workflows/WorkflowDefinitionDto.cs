// Purpose: process-owner projection of a custom workflow definition.
// Main members: Id, Title, Draft, PublishedVersionId, PublishedNumber, Mode, ModeReason and created/updated attribution.

namespace ParishLife.Api.DTOs.Workflows;

public class WorkflowDefinitionDto
{
    public string Id { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public WorkflowTemplateDto Draft { get; set; } = new();

    public string? PublishedVersionId { get; set; } = null;

    public int PublishedNumber { get; set; }

    public string Mode { get; set; } = string.Empty;

    public string? ModeReason { get; set; } = null;

    public DateTimeOffset CreatedAt { get; set; }

    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset UpdatedAt { get; set; }

    public string UpdatedBy { get; set; } = string.Empty;
}
