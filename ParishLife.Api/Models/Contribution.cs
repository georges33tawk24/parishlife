// Purpose: represents one posted gift or a linked reversal; posted gifts are corrected only by reversal or reclassification.
// Main members: Id, ParishId, SessionId, Amount, Currency, Method, FundId, CampaignId, PersonId, HouseholdId, Anonymous, ReceivedOn, Status, correction links and actors.

namespace ParishLife.Api.Models;

public class Contribution
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string? SessionId { get; set; } = null;

    // Negative for reversals.
    public decimal Amount { get; set; }

    public string Currency { get; set; } = string.Empty;

    public string Method { get; set; } = string.Empty;

    public string FundId { get; set; } = string.Empty;

    public string? CampaignId { get; set; } = null;

    public string? PersonId { get; set; } = null;

    public string? HouseholdId { get; set; } = null;

    public bool Anonymous { get; set; }

    public DateOnly ReceivedOn { get; set; }

    // Posted, Reversed or Reversal.
    public string Status { get; set; } = "Posted";

    public string? ReversalOf { get; set; } = null;

    public string? ReclassifiedFrom { get; set; } = null;

    public string? Reason { get; set; } = null;

    public string PostedBy { get; set; } = string.Empty;

    public DateTimeOffset PostedAt { get; set; }
}
