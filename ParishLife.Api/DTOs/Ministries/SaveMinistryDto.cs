// Purpose: represents save ministry input/output data.
// Main members: OperationId, Version, Name, Kind, Purpose, EligibilityPolicyReference.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Ministries;

public class SaveMinistryDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [StringLength(1024)]
    public string? Version { get; set; }

    [Required]
    [StringLength(500)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [StringLength(500)]
    public string Kind { get; set; } = string.Empty;

    [Required]
    [StringLength(10000)]
    public string Purpose { get; set; } = string.Empty;

    [StringLength(500)]
    public string? EligibilityPolicyReference { get; set; } = null;
}
