// Purpose: imports bank statement lines from CSV with header Date,Reference,Amount,Currency (amounts signed).
// Main members: OperationId, BankAccount and Csv.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Finance;

public class ImportBankLinesDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(100)]
    public string BankAccount { get; set; } = string.Empty;

    [Required]
    [StringLength(300000)]
    public string Csv { get; set; } = string.Empty;
}
