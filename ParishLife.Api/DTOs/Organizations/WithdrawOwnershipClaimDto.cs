// Purpose: the claimant's withdrawal of its own open ownership claim at the exact current version.
// Main members: OperationId, Version.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Organizations;

public class WithdrawOwnershipClaimDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;
}
