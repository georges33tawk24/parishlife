// Purpose: stages a CSV people import with its provenance; columns GivenName, FamilyName, BirthDate, Contact, SourceId.
// Main members: OperationId, SourceName, SourceOwner, SourceDate, DateOrder and Csv.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.People;

public class StagePeopleImportDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(200)]
    public string SourceName { get; set; } = string.Empty;

    [Required]
    [StringLength(200)]
    public string SourceOwner { get; set; } = string.Empty;

    public DateOnly SourceDate { get; set; }

    // Needed only when the file has day/month dates that could be read either way.
    [RegularExpression("^(DMY|MDY)$")]
    public string? DateOrder { get; set; } = null;

    [Required]
    [StringLength(500000)]
    public string Csv { get; set; } = string.Empty;
}
