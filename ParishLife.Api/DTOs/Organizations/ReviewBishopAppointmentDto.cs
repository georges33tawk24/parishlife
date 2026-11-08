// Purpose: carries a second operator's explicit decision about a first-bishop proposal.
// Main members: OperationId, Version, Approve, and Reason; the server determines the reviewer from the current identity.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Organizations;

public class ReviewBishopAppointmentDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    public bool? Approve { get; set; }

    [Required]
    [StringLength(2000)]
    public string Reason { get; set; } = string.Empty;
}
