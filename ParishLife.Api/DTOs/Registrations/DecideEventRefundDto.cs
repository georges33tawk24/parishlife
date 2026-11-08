// Purpose: represents decide event refund input/output data.
// Main members: OperationId, Version, Action, Reason, EvidenceReference, OccurredAt.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Registrations;

public class DecideEventRefundDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    [StringLength(500)]
    public string Action { get; set; } = string.Empty;

    [Required]
    [StringLength(2000)]
    public string Reason { get; set; } = string.Empty;

    [StringLength(500)]
    public string? EvidenceReference { get; set; } = null;

    public DateTimeOffset? OccurredAt { get; set; } = null;
}
