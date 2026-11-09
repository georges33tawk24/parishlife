// Purpose: represents application action input/output data.
// Main members: OperationId, Version, Action, applicant-visible Reason and actual EligibilityReviewReference.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Ministries;

public class ApplicationActionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    [StringLength(30)]
    public string Action { get; set; } = string.Empty;

    [StringLength(2000)]
    public string? Reason { get; set; } = null;

    [StringLength(1000)]
    public string? EligibilityReviewReference { get; set; }
}
