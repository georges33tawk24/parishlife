// Purpose: requests a draft formation program, or a draft revision of an approved program, for one ministry.
// Main members: OperationId, Title/TitleAr, optional SupersedesProgramId and ordered Milestones whose prerequisites refer to earlier keys.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Ministries;

public class CreateFormationDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(500)]
    public string Title { get; set; } = string.Empty;

    [StringLength(500)]
    public string? TitleAr { get; set; } = null;

    [NotEmptyGuid]
    public Guid? SupersedesProgramId { get; set; } = null;

    [Required, MinLength(1), MaxLength(30)]
    public FormationMilestoneDto[] Milestones { get; set; } = Array.Empty<FormationMilestoneDto>();
}
