// Purpose: starts replacing the sign-in email; the old email stays active until the new one is proven.
// Main members: OperationId, NewEmail, CurrentPassword and CurrentCode (required when MFA is enabled).

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Accounts;

public class BeginEmailChangeDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required, EmailAddress, StringLength(254)]
    public string NewEmail { get; set; } = string.Empty;

    [Required, StringLength(200)]
    public string CurrentPassword { get; set; } = string.Empty;

    [StringLength(12, MinimumLength = 6)]
    public string? CurrentCode { get; set; }
}
