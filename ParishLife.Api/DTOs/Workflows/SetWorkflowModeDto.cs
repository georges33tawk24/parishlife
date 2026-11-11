// Purpose: changes whether a custom workflow accepts new runs (Open), pauses only new runs (PausedNew) or safety-stops existing runs too (SafetyStop).
// Main members: OperationId, Version (definition ETag), Mode and Reason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Workflows;

public class SetWorkflowModeDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required, StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required, StringLength(40)]
    public string Mode { get; set; } = string.Empty;

    [Required, StringLength(1000)]
    public string Reason { get; set; } = string.Empty;
}
