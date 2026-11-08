// Purpose: requests replacement one-use recovery codes after fresh password and authenticator proof.
// Main members: OperationId, CurrentPassword, CurrentCode.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Accounts;

public class RegenerateRecoveryCodesDto
{

    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(200)]
    public string CurrentPassword { get; set; } = string.Empty;

    [Required]
    [StringLength(12)]
    public string CurrentCode { get; set; } = string.Empty;
}
