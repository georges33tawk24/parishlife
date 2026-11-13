// Purpose: carries one formation milestone definition in program drafts and program responses.
// Main members: Key, Title/TitleAr, Description/DescriptionAr, PrerequisiteKeys and ClergyApproval.

using System.ComponentModel.DataAnnotations;

namespace ParishLife.Api.DTOs.Ministries;

public class FormationMilestoneDto
{
    [Required]
    [RegularExpression("^[a-z0-9][a-z0-9-]{0,39}$")]
    public string Key { get; set; } = string.Empty;

    [Required]
    [StringLength(300)]
    public string Title { get; set; } = string.Empty;

    [StringLength(300)]
    public string? TitleAr { get; set; } = null;

    [StringLength(1000)]
    public string? Description { get; set; } = null;

    [StringLength(1000)]
    public string? DescriptionAr { get; set; } = null;

    [Required, MaxLength(10)]
    public string[] PrerequisiteKeys { get; set; } = Array.Empty<string>();

    public bool ClergyApproval { get; set; }
}
