// Purpose: offers an actual parish jurisdiction to its bishop independently from commercial association.
// Main members: OperationId, Version, ArchdioceseId, Reason, EvidenceReference.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Organizations;

public class ProposeParishJurisdictionDto
{

    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [NotEmptyGuid]
    public Guid ArchdioceseId { get; set; }

    [Required]
    [StringLength(2000)]
    public string Reason { get; set; } = string.Empty;

    [Required]
    [StringLength(500)]
    public string EvidenceReference { get; set; } = string.Empty;
}
