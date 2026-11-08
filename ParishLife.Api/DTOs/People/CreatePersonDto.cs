// Purpose: represents create person input/output data.
// Main members: OperationId, GivenName, FamilyName, BirthDate, Contact.

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

    public DateOnly? BirthDate { get; set; }

    [StringLength(320)]
    public string? Contact { get; set; }
}
