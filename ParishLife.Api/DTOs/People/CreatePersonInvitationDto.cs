// Purpose: asks the office to issue a person invitation.
// Main members: OperationId.

using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.People;

public class CreatePersonInvitationDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }
}
