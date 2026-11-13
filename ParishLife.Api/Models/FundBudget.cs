// Purpose: a budget amount an authorized office set for one fund, calendar year and currency; spending is compared per currency only.
// Main members: Id, ParishId, FundId, Year, Currency, Amount, Note, SetBy and SetAt.

namespace ParishLife.Api.Models;

public class FundBudget
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string FundId { get; set; } = string.Empty;

    public int Year { get; set; }

    public string Currency { get; set; } = string.Empty;

    public decimal Amount { get; set; }

    public string? Note { get; set; } = null;

    public string SetBy { get; set; } = string.Empty;

    public DateTimeOffset SetAt { get; set; }
}
