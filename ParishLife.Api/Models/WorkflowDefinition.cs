// Purpose: the mutable head of one parish custom workflow: its working draft, latest published version and start/safety mode.
// Main members: Id, ParishId, Title, Draft, PublishedVersionId, PublishedNumber, Mode, ModeReason and created/updated attribution.

namespace ParishLife.Api.Models;

public class WorkflowDefinition
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public WorkflowTemplate Draft { get; set; } = new();

    public string? PublishedVersionId { get; set; } = null;

    public int PublishedNumber { get; set; }

    public string Mode { get; set; } = "Open";

    public string? ModeReason { get; set; } = null;

    public DateTimeOffset CreatedAt { get; set; }

    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset UpdatedAt { get; set; }

    public string UpdatedBy { get; set; } = string.Empty;
}
