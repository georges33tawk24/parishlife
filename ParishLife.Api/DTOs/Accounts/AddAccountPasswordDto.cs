// Purpose: requests a first password for an account that has none (made by Google or Microsoft sign-up), with a stable operation ID.
// Main members: OperationId, NewPassword and CurrentCode (only for an account with an authenticator); the password never enters
// operation metadata. The proof is a provider sign-in of this session within the last few minutes (AccountPasswordService.AddAsync).

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Accounts;

public class AddAccountPasswordDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required, StringLength(200, MinimumLength = 16)]
    public string NewPassword { get; set; } = string.Empty;

    [StringLength(12, MinimumLength = 6)]
    public string? CurrentCode { get; set; }
}
