// Purpose: returns one posted gift or reversal; donor fields are omitted for anonymous gifts.
// Main members: Id, SessionId, Amount, Currency, Method, FundId, CampaignId, PersonId, HouseholdId, Anonymous, ReceivedOn, Status, ReversalOf, ReclassifiedFrom and Reason.

namespace ParishLife.Api.DTOs.Finance;

public class ContributionDto
{
    public string Id { get; set; } = string.Empty;

    public string? SessionId { get; set; } = null;

    public decimal Amount { get; set; }

    public string Currency { get; set; } = string.Empty;

    public string Method { get; set; } = string.Empty;

    public string FundId { get; set; } = string.Empty;

    public string? CampaignId { get; set; } = null;

    public string? PersonId { get; set; } = null;

    public string? HouseholdId { get; set; } = null;

    public bool Anonymous { get; set; }

    public DateOnly ReceivedOn { get; set; }

    public string Status { get; set; } = string.Empty;

    public string? ReversalOf { get; set; } = null;

    public string? ReclassifiedFrom { get; set; } = null;

    public string? Reason { get; set; } = null;
}
