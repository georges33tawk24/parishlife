// Purpose: returns a private platform-operator CRM follow-up state; values are manual tracking, never inferred parish adoption or readiness.
// Main members: ParishId, TrackingStatus, AssignedOperatorAccountId, NextAction, FollowUpAt and attributed dates.

namespace ParishLife.Api.DTOs.Administration;

public class ParishCrmDto
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
