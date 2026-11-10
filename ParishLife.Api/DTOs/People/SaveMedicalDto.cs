// Purpose: saves a person's optional medical/allergy declaration with its purpose and source.
// Main members: OperationId, Version, Allergies, Conditions, BloodType, Notes, Source and Purpose.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.People;

public class SaveMedicalDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [StringLength(1024)]
    public string? Version { get; set; } = null;

    [StringLength(1000)]
    public string? Allergies { get; set; } = null;

    [StringLength(1000)]
    public string? Conditions { get; set; } = null;

    [RegularExpression("^(A|B|AB|O)[+-]$")]
    public string? BloodType { get; set; } = null;

    [StringLength(2000)]
    public string? Notes { get; set; } = null;

    [StringLength(300)]
    public string? Source { get; set; } = null;

    [Required]
    [StringLength(300)]
    public string Purpose { get; set; } = string.Empty;
}
