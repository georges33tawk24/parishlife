// Purpose: archives or restores an event template under its stored version.
// Main members: OperationId, Version and Action (archive or restore).

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Scheduling;

public class EventTemplateActionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^(archive|restore)$")]
    public string Action { get; set; } = string.Empty;
}
