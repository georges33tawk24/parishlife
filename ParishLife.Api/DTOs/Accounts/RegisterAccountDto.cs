// Purpose: carries public account-registration input without accepting privileged roles.
// Main members: OperationId, Email, Password, DisplayName, AgeConfirmed (the person confirms they are 13 or older: owner decision,
// 21 November 2026; no birth date is collected).

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Accounts;

public class RegisterAccountDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [EmailAddress]
    [StringLength(254)]
    public string Email { get; set; } = string.Empty;

    [Required]
    [StringLength(200, MinimumLength = 16)]
    public string Password { get; set; } = string.Empty;

    [Required]
    [StringLength(200)]
    public string DisplayName { get; set; } = string.Empty;

    public bool AgeConfirmed { get; set; }
}
