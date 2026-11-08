// Purpose: represents link ministry person input/output data.
// Main members: OperationId, Version, AccountId, PersonId, EvidenceReference.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Ministries;

public class LinkMinistryPersonDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [StringLength(1024)]
    public string? Version { get; set; }
    [NotEmptyGuid]
    public Guid AccountId { get; set; }
    [NotEmptyGuid]
    public Guid PersonId { get; set; }

    [Required]
    [StringLength(500)]
    public string EvidenceReference { get; set; } = string.Empty;
}
