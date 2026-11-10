// Purpose: creates or edits a draft/returned expense; Version is required when editing.
// Main members: OperationId, Version, Description, FundId, Payee, IncurredOn, Amount, Currency, EvidenceReference and MissingEvidenceReason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Finance;

public class SaveExpenseDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [StringLength(1024)]
    public string? Version { get; set; } = null;

    [Required]
    [StringLength(1000)]
    public string Description { get; set; } = string.Empty;

    [NotEmptyGuid]
    public Guid FundId { get; set; }

    [Required]
    [StringLength(300)]
    public string Payee { get; set; } = string.Empty;

    public DateOnly IncurredOn { get; set; }

    [Range(typeof(decimal), "0.01", "1000000000000")]
    public decimal Amount { get; set; }

    [Required]
    [RegularExpression("^[A-Z]{3}$")]
    public string Currency { get; set; } = string.Empty;

    [StringLength(500)]
    public string? EvidenceReference { get; set; } = null;

    [StringLength(1000)]
    public string? MissingEvidenceReason { get; set; } = null;
}
