// Purpose: allocates part of one posted contribution to a pledge in the same currency.
// Main members: Id, PledgeId, ContributionId, Amount, Currency, AllocatedBy and AllocatedAt.

namespace ParishLife.Api.Models;

public class PledgeAllocation
{
    public string Id { get; set; } = string.Empty;

    public string PledgeId { get; set; } = string.Empty;

    public string ContributionId { get; set; } = string.Empty;

    public decimal Amount { get; set; }

    public string Currency { get; set; } = string.Empty;

    public string AllocatedBy { get; set; } = string.Empty;

    public DateTimeOffset AllocatedAt { get; set; }
}
