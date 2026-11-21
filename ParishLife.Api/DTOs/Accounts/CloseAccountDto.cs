// Purpose: a person's own request to close their sign-in account, with fresh proof and an explicit confirmation word.
// Main members: OperationId, CurrentPassword (accounts with a password), CurrentCode (accounts with an authenticator), Confirmation
// (must be "CLOSE"). Proofs never enter the operation fingerprint, receipt or audit.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Accounts;

public class CloseAccountDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [StringLength(200)]
    public string? CurrentPassword { get; set; }

    [StringLength(12)]
    public string? CurrentCode { get; set; }

    [Required]
    [StringLength(10)]
    public string Confirmation { get; set; } = string.Empty;
}
