// Purpose: one existing person to place in a household while it is being created.
// Main members: PersonId, Role (optional, see HouseholdRoles) and InheritsAddress (defaults to the shared address).

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Models;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.People;

public class HouseholdInitialMemberDto
{
    [NotEmptyGuid]
    public Guid PersonId { get; set; }

    [RegularExpression(HouseholdRoles.Pattern)]
    public string? Role { get; set; } = null;

    public bool InheritsAddress { get; set; } = true;
}
