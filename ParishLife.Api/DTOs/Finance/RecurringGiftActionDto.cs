// Purpose: pauses, resumes or ends a recurring gift; ending needs a reason.
// Main members: OperationId, Version, Action and Reason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Finance;

public class RecurringGiftActionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^(pause|resume|end)$")]
    public string Action { get; set; } = string.Empty;

    [StringLength(1000)]
    public string? Reason { get; set; } = null;
}
