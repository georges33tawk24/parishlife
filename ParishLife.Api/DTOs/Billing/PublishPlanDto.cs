// Purpose: represents publish plan input/output data.
// Main members: OperationId, Name, Amount, Currency, MinorUnits, TermMonths, Modules.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Billing;

public class PublishPlanDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(500)]
    public string Name { get; set; } = string.Empty;

    public decimal Amount { get; set; }

    [Required]
    [StringLength(500)]
    public string Currency { get; set; } = string.Empty;

    public int MinorUnits { get; set; }

    public int TermMonths { get; set; }
    [Required]
    public string[] Modules { get; set; } = Array.Empty<string>();
}
