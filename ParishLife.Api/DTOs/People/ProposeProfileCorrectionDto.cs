// Purpose: proposes corrections to the caller's own official Person record.
// Main members: OperationId and Fields.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.People;

public class ProposeProfileCorrectionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [MinLength(1)]
    [MaxLength(4)]
    public ProfileCorrectionFieldDto[] Fields { get; set; } = Array.Empty<ProfileCorrectionFieldDto>();
}
