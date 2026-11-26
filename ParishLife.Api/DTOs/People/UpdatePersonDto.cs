// Purpose: office edit of a person's core record; every field is replaced as sent and Version must match the stored record.
// Main members: OperationId, Version, GivenName, FamilyName, GivenNameAr, FamilyNameAr, BirthDate (not in the future, at most 110 years ago), Contact, Phones, Rite and RegisterStatus. Names hold letters only.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.People;

public class UpdatePersonDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    [StringLength(100)]
    [PersonName]
    [Display(Name = "Given name")]
    public string GivenName { get; set; } = string.Empty;

    [Required]
    [StringLength(100)]
    [PersonName]
    [Display(Name = "Family name")]
    public string FamilyName { get; set; } = string.Empty;

    [StringLength(100)]
    [PersonName(Arabic = true)]
    [Display(Name = "Arabic given name")]
    public string? GivenNameAr { get; set; } = null;

    [StringLength(100)]
    [PersonName(Arabic = true)]
    [Display(Name = "Arabic family name")]
    public string? FamilyNameAr { get; set; } = null;

    public DateOnly? BirthDate { get; set; }

    [StringLength(320)]
    public string? Contact { get; set; }

    // Every number replaces the stored list; an empty list removes them all.
    [MaxLength(5)]
    public PersonPhoneDto[] Phones { get; set; } = Array.Empty<PersonPhoneDto>();

    [StringLength(100)]
    public string? Rite { get; set; } = null;

    [RegularExpression("^(Member|Visitor)$")]
    public string? RegisterStatus { get; set; } = null;
}
