// Purpose: returns a pledge with the actual amount allocated to it.
// Main members: Id, PersonId, HouseholdId, FundId, CampaignId, Amount, Currency, Allocated, Schedule, StartsOn, EndsOn and Status.

namespace ParishLife.Api.DTOs.Finance;

public class PledgeDto
{
    public string Id { get; set; } = string.Empty;

    public string? PersonId { get; set; } = null;

    public string? HouseholdId { get; set; } = null;

    public string FundId { get; set; } = string.Empty;

    public string? CampaignId { get; set; } = null;

    public decimal Amount { get; set; }

    public string Currency { get; set; } = string.Empty;

    public decimal Allocated { get; set; }

    public string? Schedule { get; set; } = null;

    public DateOnly StartsOn { get; set; }

    public DateOnly? EndsOn { get; set; } = null;

    public string Status { get; set; } = string.Empty;
}
