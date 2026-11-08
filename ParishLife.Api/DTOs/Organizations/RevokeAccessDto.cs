// Purpose: represents revoke access input/output data.
// Main members: OperationId, Version, AccountId, Reason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Organizations;

public class RevokeAccessDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;
    [NotEmptyGuid]
    public Guid AccountId { get; set; }

    [Required]
    [StringLength(2000)]
    public string Reason { get; set; } = string.Empty;
}
