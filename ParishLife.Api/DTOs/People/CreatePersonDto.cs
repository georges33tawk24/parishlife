// Purpose: represents create person input data.
// Main members: OperationId, GivenName, FamilyName, GivenNameAr, FamilyNameAr, BirthDate, Contact, Rite and RegisterStatus.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.People;

public class CreatePersonDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(500)]
    public string GivenName { get; set; } = string.Empty;

    [Required]
    [StringLength(500)]
    public string FamilyName { get; set; } = string.Empty;

    [StringLength(500)]
    public string? GivenNameAr { get; set; } = null;

    [StringLength(500)]
    public string? FamilyNameAr { get; set; } = null;

    public DateOnly? BirthDate { get; set; }

    [StringLength(320)]
    public string? Contact { get; set; }

    [StringLength(100)]
    public string? Rite { get; set; } = null;

    [RegularExpression("^(Member|Visitor)$")]
    public string? RegisterStatus { get; set; } = null;
}
