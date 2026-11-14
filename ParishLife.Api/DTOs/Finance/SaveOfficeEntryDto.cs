// Purpose: adds or edits an office allowance or purchase while its month is open.
// Main members: OperationId, Version, Kind, OccurredOn, Amount, Currency, Description, DescriptionAr, Category, Supplier, EvidenceReference, MissingEvidenceReason and FinanceReference.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Finance;

public class SaveOfficeEntryDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [StringLength(1024)]
    public string? Version { get; set; } = null;

    [Required]
    [RegularExpression("^(Allowance|Purchase)$")]
    public string Kind { get; set; } = string.Empty;

    public DateOnly OccurredOn { get; set; }

    public decimal Amount { get; set; }

    [Required]
    [StringLength(3)]
    public string Currency { get; set; } = string.Empty;

    [Required]
    [StringLength(300)]
    public string Description { get; set; } = string.Empty;

    [StringLength(300)]
    public string? DescriptionAr { get; set; } = null;

    [StringLength(100)]
    public string? Category { get; set; } = null;

    [StringLength(200)]
    public string? Supplier { get; set; } = null;

    [StringLength(300)]
    public string? EvidenceReference { get; set; } = null;

    [StringLength(500)]
    public string? MissingEvidenceReason { get; set; } = null;

    [StringLength(100)]
    public string? FinanceReference { get; set; } = null;
}
