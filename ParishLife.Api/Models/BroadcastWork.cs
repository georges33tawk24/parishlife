// Purpose: one pending due-time work item for the broadcast processor: a scheduled store of an approved broadcast, or an automation's next run.
// The item is removed when its target runs, is unscheduled, cancelled, paused or ended.
// Main members: Id (the target's id), ParishId, Kind (Send or Automation), TargetId and DueAt.

namespace ParishLife.Api.Models;

public class BroadcastWork
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string Kind { get; set; } = "Send";

    public string TargetId { get; set; } = string.Empty;

    public DateTimeOffset DueAt { get; set; }
}
