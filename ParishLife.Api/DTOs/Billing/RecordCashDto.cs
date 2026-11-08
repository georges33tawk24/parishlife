// Purpose: represents record cash input/output data.
// Main members: OperationId, Version, Amount, Currency, ReceivedAt, PayerName, CollectedBy, and related workflow details.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Billing;

public class RecordCashDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    public decimal Amount { get; set; }

    [Required]
    [StringLength(500)]
    public string Currency { get; set; } = string.Empty;

    public DateTimeOffset ReceivedAt { get; set; }

    [Required]
    [StringLength(500)]
    public string PayerName { get; set; } = string.Empty;

    [Required]
    [StringLength(500)]
    public string CollectedBy { get; set; } = string.Empty;

    [Required]
    [StringLength(500)]
    public string ReceiptReference { get; set; } = string.Empty;
}
