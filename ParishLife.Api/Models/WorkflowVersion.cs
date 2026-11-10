// Purpose: one immutable published version of a custom workflow; runs pin it, so later drafts never change submitted work.
// Main members: Id, DefinitionId, ParishId, Number, Title, Template, DraftVersion (the reviewed draft ETag), PublishedAt and PublishedBy.

namespace ParishLife.Api.Models;

public class WorkflowVersion
{
    public string Id { get; set; } = string.Empty;

    public string DefinitionId { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public int Number { get; set; }

    public string Title { get; set; } = string.Empty;

    public WorkflowTemplate Template { get; set; } = new();

    public string DraftVersion { get; set; } = string.Empty;

    public DateTimeOffset PublishedAt { get; set; }

    public string PublishedBy { get; set; } = string.Empty;
}
