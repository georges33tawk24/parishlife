// Purpose: cancels (or ends early) a maintenance block with its current version and a reason, releasing the room.
// Main members: OperationId, Version, Action and Reason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Scheduling;

public class MaintenanceActionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^cancel$")]
    public string Action { get; set; } = "cancel";

    [Required]
    [StringLength(2000)]
    public string Reason { get; set; } = string.Empty;
}
