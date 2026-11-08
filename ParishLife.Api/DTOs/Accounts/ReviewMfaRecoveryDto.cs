// Purpose: records another operator actual recovery decision with fresh credentials and identity-review evidence.
// Main members: OperationId, Version, Approve, CurrentPassword, CurrentCode, Reason, VerificationReference.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Accounts;

public class ReviewMfaRecoveryDto
{

    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    public bool? Approve { get; set; }

    [Required]
    [StringLength(200)]
    public string CurrentPassword { get; set; } = string.Empty;

    [Required]
    [StringLength(12)]
    public string CurrentCode { get; set; } = string.Empty;

    [Required]
    [StringLength(2000)]
    public string Reason { get; set; } = string.Empty;

    [Required]
    [StringLength(500)]
    public string VerificationReference { get; set; } = string.Empty;
}
