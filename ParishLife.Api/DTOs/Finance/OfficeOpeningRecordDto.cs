// Purpose: shows the recorded opening office balance for one currency.
// Main members: Currency, Amount, EffectiveOn, Provenance, EnteredBy and EnteredAt.

namespace ParishLife.Api.DTOs.Finance;

public class OfficeOpeningRecordDto
{
    public string Currency { get; set; } = string.Empty;

    public decimal Amount { get; set; }

    public DateOnly EffectiveOn { get; set; }

    public string Provenance { get; set; } = string.Empty;

    public string EnteredBy { get; set; } = string.Empty;

    public DateTimeOffset EnteredAt { get; set; }
}
