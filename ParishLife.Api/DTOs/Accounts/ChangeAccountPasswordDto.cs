// Purpose: requests a personal password change with a stable operation ID and fresh private credential proofs.
// Main members: OperationId, CurrentPassword, NewPassword and CurrentCode; credentials are never included in operation metadata.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Accounts;

public class ChangeAccountPasswordDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required, StringLength(200)]
    public string CurrentPassword { get; set; } = string.Empty;

    [Required, StringLength(200, MinimumLength = 16)]
    public string NewPassword { get; set; } = string.Empty;

    [StringLength(12, MinimumLength = 6)]
    public string? CurrentCode { get; set; }
}
