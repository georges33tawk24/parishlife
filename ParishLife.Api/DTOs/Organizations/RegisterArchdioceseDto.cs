// Purpose: represents register archdiocese input/output data.
// Main members: OperationId, Name, Locality.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Organizations;

public class RegisterArchdioceseDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(500)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [StringLength(500)]
    public string Locality { get; set; } = string.Empty;
}
