// Purpose: requests cancellation of the member's own registration before arrival.
// Main members: OperationId, Version and Reason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Registrations;

public class CancelOwnRegistrationDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    [StringLength(2000)]
    public string Reason { get; set; } = string.Empty;
}
