// Purpose: records the named invitee explicit acceptance or decline without self-selecting any role.
// Main members: OperationId, Version, Accept, Reason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Organizations;

public class DecideStaffAppointmentDto
{

    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    public bool? Accept { get; set; }

    [StringLength(2000)]
    public string? Reason { get; set; }
}
