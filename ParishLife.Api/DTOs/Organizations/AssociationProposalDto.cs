// Purpose: represents association proposal input/output data.
// Main members: OperationId, Version, ArchdioceseId.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Organizations;

public class AssociationProposalDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;
    [NotEmptyGuid]
    public Guid ArchdioceseId { get; set; }
}
