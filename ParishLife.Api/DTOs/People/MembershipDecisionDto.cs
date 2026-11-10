// Purpose: records the office's membership review decision.
// Main members: OperationId, Version, Action, PersonId, EvidenceReference, Reason and AllowPossibleDuplicate.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.People;

public class MembershipDecisionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^(link|create-person|return|decline)$")]
    public string Action { get; set; } = string.Empty;

    [NotEmptyGuid]
    public Guid? PersonId { get; set; } = null;

    [StringLength(500)]
    public string? EvidenceReference { get; set; } = null;

    [StringLength(2000)]
    public string? Reason { get; set; } = null;

    public bool AllowPossibleDuplicate { get; set; }
}
