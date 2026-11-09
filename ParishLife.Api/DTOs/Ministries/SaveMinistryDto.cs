// Purpose: represents save ministry input/output data.
// Main members: OperationId, Version, Name, Kind, Purpose, EligibilityPolicyReference, PublicInformation.

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
    [StringLength(200)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [StringLength(80)]
    public string Kind { get; set; } = string.Empty;

    [Required]
    [StringLength(4000)]
    public string Purpose { get; set; } = string.Empty;

    [StringLength(1000)]
    public string? EligibilityPolicyReference { get; set; } = null;
    [StringLength(4000)]
    public string? PublicInformation { get; set; }
}
