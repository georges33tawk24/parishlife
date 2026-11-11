// Purpose: ends an exact-message review, with a closing note and the neutral outcome told to any reporter.
// Main members: OperationId, Version, Note and ReporterOutcome.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Communications;

public class CloseMessageReviewDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required, StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required, StringLength(2000)]
    public string Note { get; set; } = string.Empty;

    [StringLength(500)]
    public string? ReporterOutcome { get; set; } = null;
}
