// Purpose: records the current bishop explicit factual jurisdiction decision.
// Main members: OperationId, Version, Accept, Reason, CurrentPassword, CurrentCode.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Organizations;

public class DecideParishJurisdictionDto
{

    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    public bool? Accept { get; set; }

    [Required]
    [StringLength(2000)]
    public string Reason { get; set; } = string.Empty;

    [Required]
    [StringLength(200)]
    public string CurrentPassword { get; set; } = string.Empty;

    [Required]
    [StringLength(12)]
    public string CurrentCode { get; set; } = string.Empty;
}
