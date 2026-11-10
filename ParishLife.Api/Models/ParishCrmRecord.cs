// Purpose: stores an operator-entered parish support/adoption follow-up record without deriving official parish facts or platform permissions.
// Main members: ParishId, TrackingStatus, optional assigned operator/next action/UTC follow-up and attributed creation/update dates.

namespace ParishLife.Api.Models;

public class ParishCrmRecord
{
    public string ParishId { get; set; } = string.Empty;
    public string TrackingStatus { get; set; } = string.Empty;
    public string? AssignedOperatorAccountId { get; set; } = null;
    public string? NextAction { get; set; } = null;
    public DateTimeOffset? FollowUpAt { get; set; } = null;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public string UpdatedBy { get; set; } = string.Empty;
}
