// Purpose: projection of one immutable published workflow version, used as the starter's form preview.
// Main members: Id, DefinitionId, Number, Title, Template, PublishedAt and PublishedBy.

namespace ParishLife.Api.DTOs.Workflows;

public class WorkflowVersionDto
{
    public string Id { get; set; } = string.Empty;

    public string DefinitionId { get; set; } = string.Empty;

    public int Number { get; set; }

    public string Title { get; set; } = string.Empty;

    public WorkflowTemplateDto Template { get; set; } = new();

    public DateTimeOffset PublishedAt { get; set; }

    public string PublishedBy { get; set; } = string.Empty;
}
