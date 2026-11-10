// Purpose: a reviewed, closed office ledger month with per-currency figures; its entries can then only be reversed, not edited.
// Main members: Period, ParishId, Totals, NegativeCurrencies, ClosedBy and ClosedAt.

namespace ParishLife.Api.Models;

public class OfficeMonth
{
    public string Period { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public Dictionary<string, OfficeMonthTotal> Totals { get; set; } = new();

    public string[] NegativeCurrencies { get; set; } = Array.Empty<string>();

    public string ClosedBy { get; set; } = string.Empty;

    public DateTimeOffset ClosedAt { get; set; }
}
