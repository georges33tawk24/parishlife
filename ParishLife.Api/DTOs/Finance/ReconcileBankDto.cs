// Purpose: closes or reopens one bank account's month.
// Main members: OperationId, BankAccount, Period and Reason (reopen only).

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Finance;

public class ReconcileBankDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(100)]
    public string BankAccount { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^[0-9]{4}-(0[1-9]|1[0-2])$")]
    public string Period { get; set; } = string.Empty;

    [StringLength(1000)]
    public string? Reason { get; set; } = null;
}
