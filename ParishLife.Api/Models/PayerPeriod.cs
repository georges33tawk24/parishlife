// Purpose: one dated entry of a parish's future-coverage payer schedule, created only by an accepted payer transfer.
// Main members: PayerKind, BillingAccountId, EffectiveFrom, TransferId.

namespace ParishLife.Api.Models;

public class PayerPeriod
{
    public string PayerKind { get; set; } = string.Empty;

    public string BillingAccountId { get; set; } = string.Empty;

    public DateTimeOffset EffectiveFrom { get; set; }

    public string TransferId { get; set; } = string.Empty;
}
