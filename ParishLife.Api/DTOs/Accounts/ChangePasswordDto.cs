// Purpose: represents change password input/output data.
// Main members: CurrentPassword, NewPassword.

using System.ComponentModel.DataAnnotations;
namespace ParishLife.Api.DTOs.Accounts;

public class ChangePasswordDto
{
    [Required]
    [StringLength(200)]
    public string CurrentPassword { get; set; } = string.Empty;

    [Required]
    [StringLength(200, MinimumLength = 16)]
    public string NewPassword { get; set; } = string.Empty;
}
