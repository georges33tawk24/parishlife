// Purpose: requests a priest decision on a formation program revision.
// Main members: OperationId, Version, Action (approve or retire), ApprovalReference for approval and Reason for retirement.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Ministries;

public class FormationProgramActionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^(approve|retire)$")]
    public string Action { get; set; } = string.Empty;

    [StringLength(1000)]
    public string? ApprovalReference { get; set; } = null;

    [StringLength(2000)]
    public string? Reason { get; set; } = null;
}
