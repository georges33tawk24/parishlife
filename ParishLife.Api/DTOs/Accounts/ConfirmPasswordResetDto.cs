// Purpose: sets a new password with the one-use code emailed by a password-reset request; an account with an authenticator also gives
// its current authenticator code. Nothing here signs anyone in.
// Main members: Email, Code, NewPassword, CurrentCode.

using System.ComponentModel.DataAnnotations;

namespace ParishLife.Api.DTOs.Accounts;

public class ConfirmPasswordResetDto
{
    [Required]
    [StringLength(254)]
    public string Email { get; set; } = string.Empty;

    [Required]
    [StringLength(12)]
    public string Code { get; set; } = string.Empty;

    [Required]
    [StringLength(200, MinimumLength = 16)]
    public string NewPassword { get; set; } = string.Empty;

    [StringLength(12)]
    public string? CurrentCode { get; set; }
}
