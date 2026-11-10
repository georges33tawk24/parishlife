// Purpose: adds, moves, updates or removes a person in a household, or names the household contact.
// Main members: OperationId, Version, PersonId, Action, InheritsAddress and OwnAddress.

using System.ComponentModel.DataAnnotations;
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
    [RegularExpression("^(add|update|remove|set-contact)$")]
    public string Action { get; set; } = string.Empty;

    public bool InheritsAddress { get; set; }

    [StringLength(1000)]
    public string? OwnAddress { get; set; } = null;
}
