// Purpose: returns a fund budget for a year and currency beside what was actually paid from that fund in that year and currency.
// Main members: Id, Version, FundId, Year, Currency, Amount, Spent, Remaining, Note, SetBy and SetAt.

namespace ParishLife.Api.DTOs.Finance;

public class FundBudgetDto
{
    public string Id { get; set; } = string.Empty;

    public string Version { get; set; } = string.Empty;

    public string FundId { get; set; } = string.Empty;

    public int Year { get; set; }

    public string Currency { get; set; } = string.Empty;

    public decimal Amount { get; set; }

    // Paid expenses of this fund, in this currency, with a payment date in this year; nothing is converted.
    public decimal Spent { get; set; }

    public decimal Remaining { get; set; }

    public string? Note { get; set; } = null;

    public string SetBy { get; set; } = string.Empty;

    public DateTimeOffset SetAt { get; set; }
}
