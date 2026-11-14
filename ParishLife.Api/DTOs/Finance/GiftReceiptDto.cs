// Purpose: returns a numbered gift receipt with the current status of the gift it names.
// Main members: Id, Version, Number, ContributionId, PersonId, HouseholdId, FundId, Amount, Currency, ReceivedOn, Status, GiftStatus,
// VoidReason, VoidedBy, VoidedAt, IssuedBy, IssuedAt and Notice.

namespace ParishLife.Api.DTOs.Finance;

public class GiftReceiptDto
{
    public string Id { get; set; } = string.Empty;

    public string Version { get; set; } = string.Empty;

    public long Number { get; set; }

    public string ContributionId { get; set; } = string.Empty;

    public string? PersonId { get; set; } = null;

    public string? HouseholdId { get; set; } = null;

    public string FundId { get; set; } = string.Empty;

    public decimal Amount { get; set; }

    public string Currency { get; set; } = string.Empty;

    public DateOnly ReceivedOn { get; set; }

    public string Status { get; set; } = string.Empty;

    // Posted or Reversed (empty when the gift cannot be read); the office voids a receipt whose gift was reversed.
    public string GiftStatus { get; set; } = string.Empty;

    public string? VoidReason { get; set; } = null;

    public string? VoidedBy { get; set; } = null;

    public DateTimeOffset? VoidedAt { get; set; } = null;

    public string IssuedBy { get; set; } = string.Empty;

    public DateTimeOffset IssuedAt { get; set; }

    public string Notice { get; set; } = "Record of a gift received by the parish; not a tax receipt or legal certificate.";
}
