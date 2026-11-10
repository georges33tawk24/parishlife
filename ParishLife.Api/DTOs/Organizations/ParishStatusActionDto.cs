// Purpose: asks the jurisdiction bishop's office to suspend, reinstate or close a parish.
// Main members: OperationId, Version, Action and Reason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Organizations;

public class ParishStatusActionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^(suspend|reinstate|close)$")]
    public string Action { get; set; } = string.Empty;

    [Required]
    [StringLength(1000)]
    public string Reason { get; set; } = string.Empty;
}
