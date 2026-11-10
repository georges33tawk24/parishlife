// Purpose: records a priest's publication decision for a prayer intention.
// Main members: OperationId, Version and Decision.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Communications;

public class IntentionDecisionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^(publish-anonymous|publish-identified|keep-private|decline)$")]
    public string Decision { get; set; } = string.Empty;
}
