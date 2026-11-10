// Purpose: removes an entry from an open month or reverses one from a closed month, always with a reason.
// Main members: OperationId, Version, Action, OccurredOn (reversal date) and Reason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Finance;

public class OfficeEntryActionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^(remove|reverse)$")]
    public string Action { get; set; } = string.Empty;

    public DateOnly? OccurredOn { get; set; } = null;

    [Required]
    [StringLength(500)]
    public string Reason { get; set; } = string.Empty;
}
