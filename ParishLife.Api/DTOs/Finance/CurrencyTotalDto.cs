// Purpose: carries one total for a currency and method.
// Main members: Currency, Method and Amount.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Finance;

public class CurrencyTotalDto
{
    [Required]
    [RegularExpression("^[A-Z]{3}$")]
    public string Currency { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^(Cash|Bank|Cheque|Card|Other)$")]
    public string Method { get; set; } = string.Empty;

    public decimal Amount { get; set; }
}
