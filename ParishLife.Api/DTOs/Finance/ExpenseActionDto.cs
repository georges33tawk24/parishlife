// Purpose: requests one expense transition.
// Main members: OperationId, Version, Action, Reason, PaidOn and PaymentReference.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Finance;

public class ExpenseActionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^(submit|return|approve|reject|cancel|record-payment)$")]
    public string Action { get; set; } = string.Empty;

    [StringLength(2000)]
    public string? Reason { get; set; } = null;

    public DateOnly? PaidOn { get; set; } = null;

    [StringLength(300)]
    public string? PaymentReference { get; set; } = null;
}
