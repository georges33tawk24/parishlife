// Purpose: records the competent authority's official numbering scheme for one sacrament register.
// Main members: OperationId, Sacrament, Format, PerYear and ApprovalReference.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Sacraments;

public class NumberingPolicyDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [RegularExpression("^(Baptism|FirstCommunion|Confirmation|Marriage|Funeral|Anointing|Other)$")]
    public string Sacrament { get; set; } = string.Empty;

    [Required]
    [StringLength(100)]
    public string Format { get; set; } = string.Empty;

    public bool PerYear { get; set; }

    [Required]
    [StringLength(1000)]
    public string ApprovalReference { get; set; } = string.Empty;
}
