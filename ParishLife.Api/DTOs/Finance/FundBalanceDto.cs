// Purpose: returns one fund's balance in one currency; currencies are never combined into one figure.
// Main members: FundId, FundName, Currency, Received, Paid and Balance.

namespace ParishLife.Api.DTOs.Finance;

public class FundBalanceDto
{
    public string FundId { get; set; } = string.Empty;

    public string FundName { get; set; } = string.Empty;

    public string Currency { get; set; } = string.Empty;

    public decimal Received { get; set; }

    public decimal Paid { get; set; }

    public decimal Balance { get; set; }
}
