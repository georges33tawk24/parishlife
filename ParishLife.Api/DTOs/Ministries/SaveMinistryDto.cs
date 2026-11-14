// Purpose: represents save ministry input/output data.
// Main members: OperationId, Version, Name/NameAr, Kind, Purpose/PurposeAr, EligibilityPolicyReference, PublicInformation/PublicInformationAr.

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

    [StringLength(200)]
    public string? NameAr { get; set; }

    [Required]
    [StringLength(80)]
    public string Kind { get; set; } = string.Empty;

    [Required]
    [StringLength(4000)]
    public string Purpose { get; set; } = string.Empty;

    [StringLength(4000)]
    public string? PurposeAr { get; set; }

    [StringLength(1000)]
    public string? EligibilityPolicyReference { get; set; } = null;
    [StringLength(4000)]
    public string? PublicInformation { get; set; }

    [StringLength(4000)]
    public string? PublicInformationAr { get; set; }
}
