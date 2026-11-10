// Purpose: records that a suggested pair are different people or need more information.
// Main members: OperationId, PersonA, PersonB, Decision and Reason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.People;

public class DuplicateDecisionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [NotEmptyGuid]
    public Guid PersonA { get; set; }

    [NotEmptyGuid]
    public Guid PersonB { get; set; }

    [Required]
    [RegularExpression("^(different|need-information)$")]
    public string Decision { get; set; } = string.Empty;

    [Required]
    [StringLength(1000)]
    public string Reason { get; set; } = string.Empty;
}
