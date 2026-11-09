// Purpose: validates a version-bound confirm/cancel decision for a source-owned ministry meeting.
// Main members: OperationId, Version, Action and required cancellation Reason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Ministries;

public class MinistryMeetingActionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required, StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required, StringLength(20)]
    public string Action { get; set; } = string.Empty;

    [StringLength(2000)]
    public string? Reason { get; set; }
}
