// Purpose: one actual money movement on a rental agreement: a deposit or fee received, a deposit refund, a retained deposit or a waiver.
// Main members: Kind, Amount, On, Reference, Reason and By.

namespace ParishLife.Api.Models;

public class RentalPayment
{
    // DepositReceived, FeeReceived, DepositRefunded, DepositRetained or FeeWaived.
    public string Kind { get; set; } = string.Empty;

    public decimal Amount { get; set; }

    public DateOnly On { get; set; }

    public string? Reference { get; set; }

    public string? Reason { get; set; }

    public string By { get; set; } = string.Empty;
}
