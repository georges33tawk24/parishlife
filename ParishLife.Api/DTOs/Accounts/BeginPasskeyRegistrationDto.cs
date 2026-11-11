// Purpose: requests WebAuthn creation options after fresh proof of the current credentials.
// Main members: CurrentPassword and CurrentCode (required when MFA is enabled); neither enters operation metadata.

using System.ComponentModel.DataAnnotations;

namespace ParishLife.Api.DTOs.Accounts;

public class BeginPasskeyRegistrationDto
{
    [Required, StringLength(200)]
    public string CurrentPassword { get; set; } = string.Empty;

    [StringLength(12, MinimumLength = 6)]
    public string? CurrentCode { get; set; }
}
