// Purpose: records the result of the run's current step by an actor holding that step's permission.
// Main members: OperationId, Version (run ETag), StepKey (must be the current step), Result (Completed or Declined) and Note (required to decline).

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Workflows;

public class RecordWorkflowStepDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required, StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required, StringLength(60)]
    public string StepKey { get; set; } = string.Empty;

    [Required, StringLength(20)]
    public string Result { get; set; } = string.Empty;

    [StringLength(2000)]
    public string? Note { get; set; } = null;
}
