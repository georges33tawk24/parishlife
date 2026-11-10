// Purpose: asks for a people export with an explicit purpose, columns and scope.
// Main members: OperationId, Purpose, Columns and IncludeArchived.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.People;

public class PeopleExportDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(500)]
    public string Purpose { get; set; } = string.Empty;

    [Required]
    [MinLength(1)]
    [MaxLength(5)]
    public string[] Columns { get; set; } = Array.Empty<string>();

    public bool IncludeArchived { get; set; }
}
