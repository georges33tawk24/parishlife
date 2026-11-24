// Purpose: asks the office to issue a person invitation.
// Main members: OperationId, Allows (optional office access the parish controller gives with the invitation, applied on acceptance).

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.People;

public class CreatePersonInvitationDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [MaxLength(40)]
    public string[]? Allows { get; set; }
}
