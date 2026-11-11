// Purpose: the platform recovery reviewer's explicit decision on one exact ownership-claim version.
// Main members: OperationId, Version, Recover (required so omission never becomes a rejection), Reason, EvidenceReference.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Organizations;

public class DecideOwnershipClaimDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    public bool? Recover { get; set; }

    [Required]
    [StringLength(1000)]
    public string Reason { get; set; } = string.Empty;

    [Required]
    [StringLength(500)]
    public string EvidenceReference { get; set; } = string.Empty;
}
