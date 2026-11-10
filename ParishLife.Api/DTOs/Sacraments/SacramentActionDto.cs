// Purpose: requests one sacramental case transition with the conditional schedule, celebration, instruction and reason fields.
// Main members: OperationId, Version, Action, ScheduledAt, CelebrantAccountId, CelebrantName, CelebratedAt, Place, Witnesses, Facts, BookReference, Reason and the recorded priest instruction.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Sacraments;

public class SacramentActionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^(accept|schedule|reschedule|decline|cancel|record-celebration|amend-facts|return-entry|register)$")]
    public string Action { get; set; } = string.Empty;

    public DateTimeOffset? ScheduledAt { get; set; } = null;

    [NotEmptyGuid]
    public Guid? CelebrantAccountId { get; set; } = null;

    [StringLength(200)]
    public string? CelebrantName { get; set; } = null;

    public DateTimeOffset? CelebratedAt { get; set; } = null;

    [StringLength(300)]
    public string? Place { get; set; } = null;

    [StringLength(1000)]
    public string? Witnesses { get; set; } = null;

    public Dictionary<string, string>? Facts { get; set; } = null;

    [StringLength(200)]
    public string? BookReference { get; set; } = null;

    [StringLength(2000)]
    public string? Reason { get; set; } = null;

    [NotEmptyGuid]
    public Guid? InstructingPriestAccountId { get; set; } = null;

    [StringLength(1000)]
    public string? InstructionBasis { get; set; } = null;

    public DateTimeOffset? InstructionGivenAt { get; set; } = null;
}
