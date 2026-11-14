// Purpose: an exchange rate an authorized parish office recorded with its effective date and source. It is reference information only:
// ParishLife never fetches a rate, never invents one and never converts a stored amount with it.
// Main members: Id, ParishId, BaseCurrency, QuoteCurrency, Rate, EffectiveOn, Source, Note, RecordedBy and RecordedAt.

namespace ParishLife.Api.Models;

public class ExchangeRate
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    // One unit of BaseCurrency is worth Rate units of QuoteCurrency (for example 1 USD = 89500 LBP).
    public string BaseCurrency { get; set; } = string.Empty;

    public string QuoteCurrency { get; set; } = string.Empty;

    public decimal Rate { get; set; }

    public DateOnly EffectiveOn { get; set; }

    // Where the office took the rate from, as typed by the office (for example the published bank rate of that day).
    public string Source { get; set; } = string.Empty;

    public string? Note { get; set; } = null;

    public string RecordedBy { get; set; } = string.Empty;

    public DateTimeOffset RecordedAt { get; set; }
}
