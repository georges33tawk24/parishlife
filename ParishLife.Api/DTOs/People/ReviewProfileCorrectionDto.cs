// Purpose: reviews a profile correction field by field.
// Main members: OperationId, Version and Decisions.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.People;

public class ReviewProfileCorrectionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    [MinLength(1)]
    [MaxLength(4)]
    public FieldDecisionDto[] Decisions { get; set; } = Array.Empty<FieldDecisionDto>();
}
