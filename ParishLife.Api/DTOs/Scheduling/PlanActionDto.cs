// Purpose: requests one plan transition: submit, return, approve, complete or cancel.
// Main members: OperationId, Version, Action and Reason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Scheduling;

public class PlanActionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^(submit|return|approve|complete|cancel)$")]
    public string Action { get; set; } = string.Empty;

    [StringLength(2000)]
    public string? Reason { get; set; } = null;
}
