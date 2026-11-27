// Purpose: adds, moves, updates or removes a person in a household, names the household contact, or sets the member's role.
// Main members: OperationId, Version, PersonId, Action, InheritsAddress, OwnAddress and Role (for add and set-role; empty clears it on set-role).

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Models;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.People;

public class HouseholdMemberActionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [NotEmptyGuid]
    public Guid PersonId { get; set; }

    [Required]
    [RegularExpression("^(add|update|remove|set-contact|set-role)$")]
    public string Action { get; set; } = string.Empty;

    public bool InheritsAddress { get; set; }

    [StringLength(1000)]
    public string? OwnAddress { get; set; } = null;

    [RegularExpression(HouseholdRoles.Pattern)]
    public string? Role { get; set; } = null;
}
