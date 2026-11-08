// Purpose: represents create formation input/output data.
// Main members: OperationId, Title, Milestones.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Models;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Ministries;

public class CreateFormationDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(500)]
    public string Title { get; set; } = string.Empty;
    [Required]
    public FormationMilestone[] Milestones { get; set; } = Array.Empty<FormationMilestone>();
}
