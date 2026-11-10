// Purpose: withdraws a given consent with a reason; the original record stays.
// Main members: OperationId, Version and Reason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.People;

public class WithdrawConsentDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [StringLength(500)]
    public string? Reason { get; set; } = null;
}
