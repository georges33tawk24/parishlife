// Purpose: the current-cycle state of one pinned step inside a workflow run (earlier cycles stay in the run history).
// Main members: Key, Title, Permission, ViewsRestricted, Status (Pending/Skipped/Completed/Declined), CompletedBy, CompletedAt and Note.

namespace ParishLife.Api.Models;

public class WorkflowRunStep
{
    public string Key { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string Permission { get; set; } = string.Empty;

    public bool ViewsRestricted { get; set; }

    public string Status { get; set; } = "Pending";

    public string? CompletedBy { get; set; } = null;

    public DateTimeOffset? CompletedAt { get; set; } = null;

    public string? Note { get; set; } = null;
}
