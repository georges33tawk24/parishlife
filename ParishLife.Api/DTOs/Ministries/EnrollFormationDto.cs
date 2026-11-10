// Purpose: requests enrollment of one current ministry member in one approved formation program revision.
// Main members: OperationId, PersonId and ProgramVersion, which pins the exact approved revision.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Ministries;

public class EnrollFormationDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [NotEmptyGuid]
    public Guid PersonId { get; set; }

    [Required]
    [StringLength(1024)]
    public string ProgramVersion { get; set; } = string.Empty;
}
