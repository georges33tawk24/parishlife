// Purpose: appends a sanitized manual CRM note at an explicit real occurrence time, preserving the current record version.
// Main members: OperationId, Version, OccurredAt and Text; notes are not evidence of automated outreach.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Administration;

public class ParishCrmNoteDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required, StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    public DateTimeOffset OccurredAt { get; set; }

    [Required, StringLength(2000)]
    public string Text { get; set; } = string.Empty;
}
