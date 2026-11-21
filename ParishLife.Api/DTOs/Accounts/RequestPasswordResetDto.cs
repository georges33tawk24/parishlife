// Purpose: asks for a password-reset code to be emailed to an account's confirmed sign-in email (anonymous; the answer is always neutral).
// Main members: Email.

using System.ComponentModel.DataAnnotations;

namespace ParishLife.Api.DTOs.Accounts;

public class RequestPasswordResetDto
{
    [Required]
    [StringLength(254)]
    public string Email { get; set; } = string.Empty;
}
