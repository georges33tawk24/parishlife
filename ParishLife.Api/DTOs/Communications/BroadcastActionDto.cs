// Purpose: approves, sends or cancels a broadcast, or approves/retires a template, against the exact reviewed version.
// Main members: OperationId, Version, Action and Reason (required to cancel).

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Communications;

public class BroadcastActionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required, StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required, RegularExpression("^(approve|send|cancel|retire)$")]
    public string Action { get; set; } = string.Empty;

    [StringLength(2000)]
    public string? Reason { get; set; } = null;
}
