// Purpose: removes an evidence file from a case's active files with a reason; the content stays for retention.
// Main members: OperationId, Version and Reason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Files;

public class RemoveEvidenceDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    [StringLength(500)]
    public string Reason { get; set; } = string.Empty;
}
