// Purpose: sets the budget for one fund, calendar year and currency; Version is required when that budget already exists.
// Main members: OperationId, Version, FundId, Year, Currency, Amount and Note.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Finance;

public class SaveFundBudgetDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [StringLength(1024)]
    public string? Version { get; set; } = null;

    [NotEmptyGuid]
    public Guid FundId { get; set; }

    [Range(2000, 2100)]
    public int Year { get; set; }

    [Required]
    [RegularExpression("^[A-Z]{3}$")]
    public string Currency { get; set; } = string.Empty;

    [Range(typeof(decimal), "0.01", "1000000000000")]
    public decimal Amount { get; set; }

    [StringLength(500)]
    public string? Note { get; set; } = null;
}
