// Purpose: represents apply ministry input/output data.
// Main members: OperationId, Kind, PersonId, RepresentationEvidence.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Ministries;

public class ApplyMinistryDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(500)]
    public string Kind { get; set; } = string.Empty;
    [NotEmptyGuid]
    public Guid? PersonId { get; set; } = null;

    [StringLength(500)]
    public string? RepresentationEvidence { get; set; } = null;
}
