// Purpose: records an exchange rate the parish office took from a named source for a given date; it is never fetched or invented.
// Main members: OperationId, BaseCurrency, QuoteCurrency, Rate, EffectiveOn, Source and Note.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Finance;

public class RecordExchangeRateDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [RegularExpression("^[A-Z]{3}$")]
    public string BaseCurrency { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^[A-Z]{3}$")]
    public string QuoteCurrency { get; set; } = string.Empty;

    [Range(typeof(decimal), "0.000001", "1000000000000")]
    public decimal Rate { get; set; }

    public DateOnly EffectiveOn { get; set; }

    [Required]
    [StringLength(300)]
    public string Source { get; set; } = string.Empty;

    [StringLength(1000)]
    public string? Note { get; set; } = null;
}
