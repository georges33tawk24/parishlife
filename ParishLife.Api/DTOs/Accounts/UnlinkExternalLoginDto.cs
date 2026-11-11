// Purpose: removes a linked external provider after fresh credential proof.
// Main members: OperationId, CurrentPassword and CurrentCode (required when MFA is enabled).

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Accounts;

public class UnlinkExternalLoginDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required, StringLength(200)]
    public string CurrentPassword { get; set; } = string.Empty;

    [StringLength(12, MinimumLength = 6)]
    public string? CurrentCode { get; set; }
}
