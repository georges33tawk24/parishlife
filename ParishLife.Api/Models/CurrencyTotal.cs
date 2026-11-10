// Purpose: holds one total for a currency and method, never converted into another currency.
// Main members: Currency, Method and Amount.

namespace ParishLife.Api.Models;

public class CurrencyTotal
{
    public string Currency { get; set; } = string.Empty;

    public string Method { get; set; } = string.Empty;

    public decimal Amount { get; set; }
}
