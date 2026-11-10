// Purpose: reverses a posted gift, or reclassifies it to another fund/donor through a linked reversal and new gift.
// Main members: OperationId, Version, Action, Reason, FundId, PersonId, HouseholdId and Anonymous.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Finance;

public class CorrectContributionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^(reverse|reclassify)$")]
    public string Action { get; set; } = string.Empty;

    [Required]
    [StringLength(2000)]
    public string Reason { get; set; } = string.Empty;

    [NotEmptyGuid]
    public Guid? FundId { get; set; } = null;

    [NotEmptyGuid]
    public Guid? PersonId { get; set; } = null;

    [NotEmptyGuid]
    public Guid? HouseholdId { get; set; } = null;

    public bool? Anonymous { get; set; } = null;
}
