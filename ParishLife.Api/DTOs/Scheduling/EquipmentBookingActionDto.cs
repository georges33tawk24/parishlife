// Purpose: issues, returns or cancels an equipment booking.
// Main members: OperationId, Version, Action, IssuedTo, ReturnedQuantity, Condition, Evidence and Reason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Scheduling;

public class EquipmentBookingActionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^(issue|return|cancel)$")]
    public string Action { get; set; } = string.Empty;

    [StringLength(300)]
    public string? IssuedTo { get; set; } = null;

    [Range(0, 100000)]
    public int? ReturnedQuantity { get; set; } = null;

    [RegularExpression("^(Good|Damaged)$")]
    public string? Condition { get; set; } = null;

    [StringLength(1000)]
    public string? Evidence { get; set; } = null;

    [StringLength(2000)]
    public string? Reason { get; set; } = null;
}
