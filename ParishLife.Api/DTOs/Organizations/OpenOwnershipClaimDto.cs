// Purpose: a verified account's restricted claim that it should control a parish's administration, with minimal supporting evidence.
// Main members: OperationId, Statement, EvidenceReference.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Organizations;

public class OpenOwnershipClaimDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(2000)]
    public string Statement { get; set; } = string.Empty;

    [Required]
    [StringLength(500)]
    public string EvidenceReference { get; set; } = string.Empty;
}
