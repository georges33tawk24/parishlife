// Purpose: records a priest's approval or rejection of a proposed register correction.
// Main members: OperationId, Version, Approve and Note.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Sacraments;

public class DecideCorrectionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    public bool Approve { get; set; }

    [Required]
    [StringLength(2000)]
    public string Note { get; set; } = string.Empty;
}
