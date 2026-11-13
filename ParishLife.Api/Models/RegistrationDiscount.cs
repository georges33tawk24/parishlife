// Purpose: one named fixed-amount discount an event registration policy offers; the parish supplies the name and amount.
// Main members: Key, Name, NameAr (optional Arabic twin) and Amount in the policy's fee currency.

namespace ParishLife.Api.Models;

public class RegistrationDiscount
{
    public string Key { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string? NameAr { get; set; } = null;

    public decimal Amount { get; set; }
}
