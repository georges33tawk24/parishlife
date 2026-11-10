// Purpose: one immutable history row for a workflow run transition; reopening never removes earlier rows.
// Main members: Id, RunId, ParishId, Action, StepKey, FromStatus, ToStatus, Cycle, Reason, By, ActingAppointmentId and At.

namespace ParishLife.Api.Models;

public class WorkflowRunEntry
{
    public string Id { get; set; } = string.Empty;

    public string RunId { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string Action { get; set; } = string.Empty;

    public string? StepKey { get; set; } = null;

    public string? FromStatus { get; set; } = null;

    public string ToStatus { get; set; } = string.Empty;

    public int Cycle { get; set; }

    public string? Reason { get; set; } = null;

    public string By { get; set; } = string.Empty;

    public string? ActingAppointmentId { get; set; } = null;

    public DateTimeOffset At { get; set; }
}
