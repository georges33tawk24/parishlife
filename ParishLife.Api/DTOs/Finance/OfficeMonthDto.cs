// Purpose: shows a closed office month, or the current balances, per currency.
// Main members: Period, Totals, NegativeCurrencies, ClosedBy and ClosedAt.

using ParishLife.Api.Models;

namespace ParishLife.Api.DTOs.Finance;

public class OfficeMonthDto
{
    public string Period { get; set; } = string.Empty;

    public Dictionary<string, OfficeMonthTotal> Totals { get; set; } = new();

    public string[] NegativeCurrencies { get; set; } = Array.Empty<string>();

    public string? ClosedBy { get; set; }

    public DateTimeOffset? ClosedAt { get; set; }
}
