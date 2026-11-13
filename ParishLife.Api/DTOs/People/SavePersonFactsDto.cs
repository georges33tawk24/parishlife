// Purpose: saves a person's optional facts; Version is required when facts already exist.
// Main members: OperationId, Version, locality fields (Town and TownAr), Occupation, Skills, PreferredLanguage and deceased fields.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.People;

public class SavePersonFactsDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [StringLength(1024)]
    public string? Version { get; set; } = null;

    [StringLength(100)]
    public string? Country { get; set; } = null;

    [StringLength(100)]
    public string? Region { get; set; } = null;

    [StringLength(100)]
    public string? District { get; set; } = null;

    [StringLength(100)]
    public string? Town { get; set; } = null;

    [StringLength(100)]
    public string? TownAr { get; set; } = null;

    [StringLength(300)]
    public string? AddressDetail { get; set; } = null;

    [StringLength(300)]
    public string? LocalityNotListed { get; set; } = null;

    [StringLength(200)]
    public string? Occupation { get; set; } = null;

    [MaxLength(20)]
    public string[] Skills { get; set; } = Array.Empty<string>();

    [RegularExpression("^(en|fr|ar)$")]
    public string? PreferredLanguage { get; set; } = null;

    [StringLength(10)]
    public string? DeceasedOn { get; set; } = null;

    [RegularExpression("^(Exact|Year|Unknown)$")]
    public string? DeceasedPrecision { get; set; } = null;

    [StringLength(500)]
    public string? DeceasedEvidence { get; set; } = null;
}
