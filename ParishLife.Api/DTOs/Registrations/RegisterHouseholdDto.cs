// Purpose: registers several current members of one household for an event in one transaction, all answering the form version viewed.
// Main members: OperationId, HouseholdId, FormVersionId and Members.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Registrations;

public class RegisterHouseholdDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [NotEmptyGuid]
    public Guid HouseholdId { get; set; }

    [NotEmptyGuid]
    public Guid FormVersionId { get; set; }

    [Required]
    [MinLength(1)]
    [MaxLength(12)]
    public HouseholdParticipantDto[] Members { get; set; } = Array.Empty<HouseholdParticipantDto>();
}
