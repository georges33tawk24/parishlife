// Purpose: records or edits a standing intention to give (amount, currency, fund and schedule); Version is required when editing.
// Main members: OperationId, Version, PersonId, HouseholdId, FundId, Amount, Currency, Frequency, Method, StartsOn, EndsOn and Note.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Finance;

public class SaveRecurringGiftDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [StringLength(1024)]
    public string? Version { get; set; } = null;

    [NotEmptyGuid]
    public Guid? PersonId { get; set; } = null;

    [NotEmptyGuid]
    public Guid? HouseholdId { get; set; } = null;

    [NotEmptyGuid]
    public Guid FundId { get; set; }

    [Range(typeof(decimal), "0.01", "1000000000000")]
    public decimal Amount { get; set; }

    [Required]
    [RegularExpression("^[A-Z]{3}$")]
    public string Currency { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^(Weekly|Monthly|Quarterly|Yearly)$")]
    public string Frequency { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^(Cash|Bank|Cheque|Card|Other)$")]
    public string Method { get; set; } = string.Empty;

    public DateOnly StartsOn { get; set; }

    public DateOnly? EndsOn { get; set; } = null;

    [StringLength(500)]
    public string? Note { get; set; } = null;
}
