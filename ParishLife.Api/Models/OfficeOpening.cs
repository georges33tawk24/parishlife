// Purpose: the one opening office cash balance for a currency, with its effective date and provenance.
// Main members: Currency, ParishId, Amount, EffectiveOn, Provenance, By and At.

namespace ParishLife.Api.Models;

public class OfficeOpening
{
    public string Currency { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public decimal Amount { get; set; }

    public DateOnly EffectiveOn { get; set; }

    public string Provenance { get; set; } = string.Empty;

    public string By { get; set; } = string.Empty;

    public DateTimeOffset At { get; set; }
}
