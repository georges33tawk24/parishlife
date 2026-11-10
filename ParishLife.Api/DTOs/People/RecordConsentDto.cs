// Purpose: records one consent for a person, by the office from paper or by the person themselves digitally.
// Main members: OperationId, Kind, Purpose, PolicyVersion, Fields and GivenBy.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.People;

public class RecordConsentDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [RegularExpression("^(Directory|Photo|Communications|Event|Representation)$")]
    public string Kind { get; set; } = string.Empty;

    [Required]
    [StringLength(300)]
    public string Purpose { get; set; } = string.Empty;

    [Required]
    [StringLength(40)]
    public string PolicyVersion { get; set; } = string.Empty;

    [MaxLength(10)]
    public string[] Fields { get; set; } = Array.Empty<string>();

    [StringLength(200)]
    public string? GivenBy { get; set; } = null;
}
