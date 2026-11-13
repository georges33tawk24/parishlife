// Purpose: requests one sacramental case transition with the conditional schedule, celebration, instruction, review, requirement,
// request-amendment and reason fields. Arabic twins are saved exactly as typed, never copied from the Latin field.
// Main members: OperationId, Version, Action, ScheduledAt, celebrant (account, parish person, name, Arabic name), CelebratedAt, Place/PlaceAr,
// Witnesses/WitnessesAr, Facts, BookReference, RegisterPage, Reason, RequirementKey, RequirementMet, TentativeDate and the recorded priest instruction.

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
    [RegularExpression("^(accept|schedule|reschedule|decline|cancel|record-celebration|amend-facts|return-entry|register|office-review|requirement|sync-requirements|propose-amendment|approve-amendment|reject-amendment)$")]
    public string Action { get; set; } = string.Empty;

    public DateTimeOffset? ScheduledAt { get; set; } = null;

    [NotEmptyGuid]
    public Guid? CelebrantAccountId { get; set; } = null;

    [NotEmptyGuid]
    public Guid? CelebrantPersonId { get; set; } = null;

    [StringLength(200)]
    public string? CelebrantName { get; set; } = null;

    [StringLength(200)]
    public string? CelebrantNameAr { get; set; } = null;

    public DateTimeOffset? CelebratedAt { get; set; } = null;

    [StringLength(300)]
    public string? Place { get; set; } = null;

    [StringLength(300)]
    public string? PlaceAr { get; set; } = null;

    [StringLength(1000)]
    public string? Witnesses { get; set; } = null;

    [StringLength(1000)]
    public string? WitnessesAr { get; set; } = null;

    public Dictionary<string, string>? Facts { get; set; } = null;

    [StringLength(200)]
    public string? BookReference { get; set; } = null;

    [StringLength(50)]
    public string? RegisterPage { get; set; } = null;

    [StringLength(2000)]
    public string? Reason { get; set; } = null;

    // requirement: which item of the case's checklist, and whether it is now met.
    [RegularExpression("^[A-Za-z0-9_]{1,60}$")]
    public string? RequirementKey { get; set; } = null;

    public bool? RequirementMet { get; set; } = null;

    // propose-amendment: the newly requested date.
    [StringLength(200)]
    public string? TentativeDate { get; set; } = null;

    [NotEmptyGuid]
    public Guid? InstructingPriestAccountId { get; set; } = null;

    [StringLength(1000)]
    public string? InstructionBasis { get; set; } = null;

    public DateTimeOffset? InstructionGivenAt { get; set; } = null;
}
