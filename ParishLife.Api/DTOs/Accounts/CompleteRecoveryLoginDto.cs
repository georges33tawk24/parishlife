// Purpose: completes a password-bound challenge using one stored recovery code without granting privileged MFA claims.
// Main members: AccountId, Challenge, RecoveryCode.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Accounts;

public class CompleteRecoveryLoginDto
{

    [NotEmptyGuid]
    public Guid AccountId { get; set; }

    [Required]
    [StringLength(64, MinimumLength = 64)]
    public string Challenge { get; set; } = string.Empty;

    [Required]
    [StringLength(32)]
    public string RecoveryCode { get; set; } = string.Empty;
}
