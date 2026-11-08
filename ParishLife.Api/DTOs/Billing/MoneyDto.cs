// Purpose: returns the explicit authorized Money response fields without binding the persistence model.
// Main members: response properties; From maps the allowed fields and copies exposed collections.

using ParishLife.Api.Models;

namespace ParishLife.Api.DTOs.Billing;

public class MoneyDto
{
    public decimal Amount { get; set; }

    public string Currency { get; set; } = string.Empty;

    public int MinorUnits { get; set; }

    public static MoneyDto From(Money value)
    {
        return new MoneyDto
        {
            Amount = value.Amount,
            Currency = value.Currency,
            MinorUnits = value.MinorUnits
        };
    }
}
