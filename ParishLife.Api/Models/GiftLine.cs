// Purpose: represents one counted receipt in a counting session, in its actual currency.
// Main members: Key, Amount, Currency, Method, FundId, CampaignId, PersonId, HouseholdId, EnvelopeId, Unattributed, Anonymous and Reference.

namespace ParishLife.Api.Models;

public class GiftLine
{
    public string Key { get; set; } = string.Empty;

    public decimal Amount { get; set; }

    public string Currency { get; set; } = string.Empty;

    // Cash, Bank, Cheque, Card or Other.
    public string Method { get; set; } = string.Empty;

    public string FundId { get; set; } = string.Empty;

    public string? CampaignId { get; set; } = null;

    public string? PersonId { get; set; } = null;

    public string? HouseholdId { get; set; } = null;

    public string? EnvelopeId { get; set; } = null;

    // An envelope number that matched no household; kept for review, never guessed.
    public bool Unattributed { get; set; }

    public bool Anonymous { get; set; }

    public string? Reference { get; set; } = null;
}
