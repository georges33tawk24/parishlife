// Purpose: marks a roll-call participant accounted for (account), undoes a mark (unaccount), or closes the roll call (close).
// Main members: OperationId, Version, Action, RegistrationId (for account/unaccount) and Note (for close).

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Registrations;

public class EvacuationActionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    [StringLength(20)]
    public string Action { get; set; } = string.Empty;

    [NotEmptyGuid]
    public Guid? RegistrationId { get; set; } = null;

    [StringLength(2000)]
    public string? Note { get; set; } = null;
}
