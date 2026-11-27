// Purpose: asks for a people export with its columns and scope, and an optional purpose.
// Main members: OperationId, Purpose, Columns and IncludeArchived.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.People;

public class PeopleExportDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    // Optional (owner, 27 November 2026): the export is logged with or without a stated purpose.
    [StringLength(500)]
    public string? Purpose { get; set; } = null;

    [Required]
    [MinLength(1)]
    [MaxLength(5)]
    public string[] Columns { get; set; } = Array.Empty<string>();

    public bool IncludeArchived { get; set; }
}
