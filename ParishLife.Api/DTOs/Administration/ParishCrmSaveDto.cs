// Purpose: records an explicit platform-operator CRM state change with concurrency, attribution and optional follow-up assignment.
// Main members: OperationId, Version, TrackingStatus, AssignedOperatorAccountId, NextAction, FollowUpAt and Reason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Administration;

public class ParishCrmSaveDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [StringLength(1024)]
    public string? Version { get; set; } = null;

    [Required, StringLength(80)]
    public string TrackingStatus { get; set; } = string.Empty;

    [NotEmptyGuid]
    public Guid? AssignedOperatorAccountId { get; set; } = null;

    [StringLength(500)]
    public string? NextAction { get; set; } = null;

    public DateTimeOffset? FollowUpAt { get; set; } = null;

    [Required, StringLength(1000)]
    public string Reason { get; set; } = string.Empty;
}
