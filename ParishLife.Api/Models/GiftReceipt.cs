// Purpose: a numbered receipt issued for one posted, attributed gift. Numbers are unique per parish and taken in the same transaction as the
// receipt, so none is skipped; a voided receipt keeps its number. A receipt is a record of a gift received, not a tax document.
// Main members: Id, ParishId, Number, ContributionId, PersonId, HouseholdId, FundId, Amount, Currency, ReceivedOn, Status, void facts and actors.

namespace ParishLife.Api.Models;

public class GiftReceipt
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public long Number { get; set; }

    public string ContributionId { get; set; } = string.Empty;

    public string? PersonId { get; set; } = null;

    public string? HouseholdId { get; set; } = null;

    public string FundId { get; set; } = string.Empty;

    public decimal Amount { get; set; }

    public string Currency { get; set; } = string.Empty;

    public DateOnly ReceivedOn { get; set; }

    // Issued or Voided.
    public string Status { get; set; } = "Issued";

    public string? VoidReason { get; set; } = null;

    public string? VoidedBy { get; set; } = null;

    public DateTimeOffset? VoidedAt { get; set; } = null;

    public string IssuedBy { get; set; } = string.Empty;

    public DateTimeOffset IssuedAt { get; set; }
}
