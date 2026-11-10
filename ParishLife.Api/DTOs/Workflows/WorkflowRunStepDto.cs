// Purpose: projection of one pinned step in a workflow run's current cycle.
// Main members: Key, Title, Permission, Status, CompletedBy, CompletedAt and Note.

namespace ParishLife.Api.DTOs.Workflows;

public class WorkflowRunStepDto
{
    public string Key { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string Permission { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public string? CompletedBy { get; set; } = null;

    public DateTimeOffset? CompletedAt { get; set; } = null;

    public string? Note { get; set; } = null;
}
