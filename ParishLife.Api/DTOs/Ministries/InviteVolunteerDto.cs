// Purpose: requests a coordinator invitation, or with no PersonId a member's own signup, for an opportunity.
// Main members: OperationId and PersonId.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Ministries;

public class InviteVolunteerDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [NotEmptyGuid]
    public Guid? PersonId { get; set; } = null;
}
