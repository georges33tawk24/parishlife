// Purpose: records the office's identity review of an account claiming a guest request.
// Main members: OperationId, Version, Approve, EvidenceReference and Reason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Requests;

public class RequestAssociationDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    public bool Approve { get; set; }

    [StringLength(500)]
    public string? EvidenceReference { get; set; } = null;

    [StringLength(1000)]
    public string? Reason { get; set; } = null;
}
