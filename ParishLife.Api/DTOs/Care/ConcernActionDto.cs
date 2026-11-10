// Purpose: requests one reviewer or submitter transition on a concern.
// Main members: OperationId, Version, Action and NextAction.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Care;

public class ConcernActionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^(accept|start-review|respond|close|reopen|identify)$")]
    public string Action { get; set; } = string.Empty;

    [StringLength(500)]
    public string? NextAction { get; set; } = null;
}
