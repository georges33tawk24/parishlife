// Purpose: archives, restores, completes or reopens a pastoral note or task.
// Main members: OperationId, Version and Action.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Care;

public class PastoralNoteActionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^(archive|restore|complete|reopen)$")]
    public string Action { get; set; } = string.Empty;
}
