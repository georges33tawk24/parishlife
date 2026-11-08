// Purpose: proves the staged authenticator before enabling it and issuing replacement recovery codes.
// Main members: OperationId, EnrollmentId, CurrentPassword, Code, CurrentCode.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Accounts;

public class CompleteMfaEnrollmentDto
{

    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [NotEmptyGuid]
    public Guid EnrollmentId { get; set; }

    [Required]
    [StringLength(200)]
    public string CurrentPassword { get; set; } = string.Empty;

    [Required]
    [StringLength(12)]
    public string Code { get; set; } = string.Empty;

    [StringLength(12)]
    public string? CurrentCode { get; set; }
}
