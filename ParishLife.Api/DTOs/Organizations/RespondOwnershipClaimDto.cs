// Purpose: the current controlling owner's response to an open ownership claim, read by the recovery reviewer.
// Main members: OperationId, Version, Response.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Organizations;

public class RespondOwnershipClaimDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    [StringLength(2000)]
    public string Response { get; set; } = string.Empty;
}
