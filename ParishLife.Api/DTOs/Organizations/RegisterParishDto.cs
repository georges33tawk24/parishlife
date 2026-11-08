// Purpose: represents register parish input/output data.
// Main members: OperationId, Name, Locality, Contact, DeclaredArchdiocese.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Organizations;

public class RegisterParishDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(500)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [StringLength(500)]
    public string Locality { get; set; } = string.Empty;

    [Required]
    [StringLength(320)]
    public string Contact { get; set; } = string.Empty;

    [StringLength(500)]
    public string? DeclaredArchdiocese { get; set; }
}
