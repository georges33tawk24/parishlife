// Purpose: requests private authenticator setup using current credentials or an approved recovery request.
// Main members: OperationId, CurrentPassword, CurrentCode, RecoveryRequestId.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Accounts;

public class BeginMfaEnrollmentDto
{

    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(200)]
    public string CurrentPassword { get; set; } = string.Empty;

    [StringLength(12)]
    public string? CurrentCode { get; set; }

    [NotEmptyGuid]
    public Guid? RecoveryRequestId { get; set; }
}
