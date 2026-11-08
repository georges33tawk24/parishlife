// Purpose: carries the named nominee's acceptance or decline of an independently reviewed bishop invitation.
// Main members: OperationId, Version, Accept, and optional response Reason; no client-supplied role or account promotion.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Organizations;

public class DecideBishopInvitationDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    public bool? Accept { get; set; }

    [StringLength(2000)]
    public string? Reason { get; set; }
}
