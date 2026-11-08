// Purpose: carries the account-bound one-use MFA challenge and authenticator response.
// Main members: AccountId, Challenge, Code.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Accounts;

public class CompleteMfaDto
{
    [NotEmptyGuid]
    public Guid AccountId { get; set; }

    [Required]
    [StringLength(500)]
    public string Challenge { get; set; } = string.Empty;

    [Required]
    [StringLength(500)]
    public string Code { get; set; } = string.Empty;
}
