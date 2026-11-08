// Purpose: represents formation evidence input/output data.
// Main members: OperationId, PersonId, MilestoneId, EvidenceReference, AchievedAt.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Ministries;

public class FormationEvidenceDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }
    [NotEmptyGuid]
    public Guid PersonId { get; set; }

    [Required]
    [StringLength(500)]
    public string MilestoneId { get; set; } = string.Empty;

    [Required]
    [StringLength(500)]
    public string EvidenceReference { get; set; } = string.Empty;

    public DateTimeOffset AchievedAt { get; set; }
}
