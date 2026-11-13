// Purpose: pauses, resumes or ends a broadcast automation against the exact version read.
// Main members: OperationId, Version and Action.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Communications;

public class BroadcastAutomationActionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required, StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required, RegularExpression("^(pause|resume|end)$")]
    public string Action { get; set; } = string.Empty;
}
