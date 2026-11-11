// Purpose: proves ownership of an account email with the delivered one-use code.
// Main members: Email and Code; the code never enters operation metadata or audit.

using System.ComponentModel.DataAnnotations;

namespace ParishLife.Api.DTOs.Accounts;

public class ConfirmContactVerificationDto
{
    [Required, EmailAddress, StringLength(254)]
    public string Email { get; set; } = string.Empty;

    [Required, StringLength(12, MinimumLength = 6)]
    public string Code { get; set; } = string.Empty;
}
