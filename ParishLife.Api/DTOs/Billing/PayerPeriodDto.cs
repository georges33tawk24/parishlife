// Purpose: one scheduled payer change as shown to its parties.
// Main members: PayerKind, BillingAccountId, EffectiveFrom, TransferId.

namespace ParishLife.Api.DTOs.Billing;

public class PayerPeriodDto
{
    public string PayerKind { get; set; } = string.Empty;

    public string BillingAccountId { get; set; } = string.Empty;

    public DateTimeOffset EffectiveFrom { get; set; }

    public string TransferId { get; set; } = string.Empty;
}
