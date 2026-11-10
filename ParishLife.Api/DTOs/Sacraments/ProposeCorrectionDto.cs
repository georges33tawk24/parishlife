// Purpose: proposes a correction to one field of a registered entry, with reason and evidence.
// Main members: OperationId, Field, NewValue, Reason and Evidence.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Sacraments;

public class ProposeCorrectionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(80)]
    public string Field { get; set; } = string.Empty;

    [Required]
    [StringLength(2000)]
    public string NewValue { get; set; } = string.Empty;

    [Required]
    [StringLength(2000)]
    public string Reason { get; set; } = string.Empty;

    [Required]
    [StringLength(1000)]
    public string Evidence { get; set; } = string.Empty;
}
