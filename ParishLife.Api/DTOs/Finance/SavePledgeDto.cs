// Purpose: records a pledge for a person or household.
// Main members: OperationId, PersonId, HouseholdId, FundId, CampaignId, Amount, Currency, Schedule, StartsOn and EndsOn.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Finance;

public class SavePledgeDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [NotEmptyGuid]
    public Guid? PersonId { get; set; } = null;

    [NotEmptyGuid]
    public Guid? HouseholdId { get; set; } = null;

    [NotEmptyGuid]
    public Guid FundId { get; set; }

    [NotEmptyGuid]
    public Guid? CampaignId { get; set; } = null;

    [Range(typeof(decimal), "0.01", "1000000000000")]
    public decimal Amount { get; set; }

    [Required]
    [RegularExpression("^[A-Z]{3}$")]
    public string Currency { get; set; } = string.Empty;

    [StringLength(300)]
    public string? Schedule { get; set; } = null;

    public DateOnly StartsOn { get; set; }

    public DateOnly? EndsOn { get; set; } = null;
}
