// Purpose: represents an exact amount with its currency and configured decimal precision.
// Main functions: Create.

namespace ParishLife.Api.Models;

public class Money
{
    public decimal Amount { get; set; }

    public string Currency { get; set; } = string.Empty;

    public int MinorUnits { get; set; }

    public static Money Create(decimal amount, string currency, int minorUnits)
    {
        currency = Guard.Text(currency, "Currency", 3).ToUpperInvariant();
        if (currency.Length != 3 || currency.Any(c => c is < 'A' or > 'Z') || minorUnits is < 0 or > 4 || amount <= 0 || amount > 1_000_000_000_000m || decimal.Round(amount, minorUnits) != amount)
            throw new DomainException("invalid_money", "Use a positive amount, a three-letter currency and the configured precision (0–4 decimal places).");
        return new Money
        {
            Amount = amount,
            Currency = currency,
            MinorUnits = minorUnits
        };
    }
}
