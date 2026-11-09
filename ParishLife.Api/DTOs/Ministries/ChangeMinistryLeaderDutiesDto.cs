// Purpose: requests an explicitly evidenced change to an existing leader's attendance capabilities without changing office dates.
// Main members: OperationId, Version, Duties, EvidenceReference and Reason identify the conditional reviewed change.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Ministries;

public class ChangeMinistryLeaderDutiesDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required, StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required, MaxLength(3)]
    public string[] Duties { get; set; } = Array.Empty<string>();

    [Required, StringLength(1000)]
    public string EvidenceReference { get; set; } = string.Empty;

    [Required, StringLength(2000)]
    public string Reason { get; set; } = string.Empty;
}
