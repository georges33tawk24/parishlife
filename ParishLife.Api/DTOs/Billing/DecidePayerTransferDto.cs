// Purpose: the other side's explicit acceptance or decline of the exact reviewed payer-transfer version.
// Main members: OperationId, Version, Accept (required so omission never becomes a decline), Reason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Billing;

public class DecidePayerTransferDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    public bool? Accept { get; set; }

    [StringLength(1000)]
    public string? Reason { get; set; }
}
