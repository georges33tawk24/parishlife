// Purpose: represents registration policy action input/output data.
// Main members: OperationId, Version, Action.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Registrations;

public class RegistrationPolicyActionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    [StringLength(500)]
    public string Action { get; set; } = string.Empty;
}
