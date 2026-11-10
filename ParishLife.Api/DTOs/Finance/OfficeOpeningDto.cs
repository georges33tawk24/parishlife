// Purpose: records or shows the one opening office balance for a currency.
// Main members: OperationId, Currency, Amount, EffectiveOn and Provenance.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Finance;

public class OfficeOpeningDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [RegularExpression("^[A-Z]{3}$")]
    public string Currency { get; set; } = string.Empty;

    [Range(0, 1_000_000_000_000)]
    public decimal Amount { get; set; }

    public DateOnly EffectiveOn { get; set; }

    [Required]
    [StringLength(500)]
    public string Provenance { get; set; } = string.Empty;
}
