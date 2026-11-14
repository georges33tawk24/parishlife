// Purpose: replaces the title and milestones of a formation program that is still a draft (before a priest approves it).
// Main members: OperationId, Version of the draft, Title/TitleAr and ordered Milestones whose prerequisites refer to earlier keys.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Ministries;

public class UpdateFormationDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    [StringLength(500)]
    public string Title { get; set; } = string.Empty;

    [StringLength(500)]
    public string? TitleAr { get; set; } = null;

    [Required, MinLength(1), MaxLength(30)]
    public FormationMilestoneDto[] Milestones { get; set; } = Array.Empty<FormationMilestoneDto>();
}
