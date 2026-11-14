// Purpose: returns a recorded exchange rate with its date, source and the account that recorded it.
// Main members: Id, BaseCurrency, QuoteCurrency, Rate, EffectiveOn, Source, Note, RecordedBy, RecordedAt and Notice.

namespace ParishLife.Api.DTOs.Finance;

public class ExchangeRateDto
{
    public string Id { get; set; } = string.Empty;

    public string BaseCurrency { get; set; } = string.Empty;

    public string QuoteCurrency { get; set; } = string.Empty;

    public decimal Rate { get; set; }

    public DateOnly EffectiveOn { get; set; }

    public string Source { get; set; } = string.Empty;

    public string? Note { get; set; } = null;

    public string RecordedBy { get; set; } = string.Empty;

    public DateTimeOffset RecordedAt { get; set; }

    public string Notice { get; set; } = "Recorded by the parish office from the named source; stored amounts are never converted with it.";
}
