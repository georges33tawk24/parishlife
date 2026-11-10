// Purpose: decides one proposed field change.
// Main members: Field, Approve and Reason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.People;

public class FieldDecisionDto
{
    [Required]
    [RegularExpression("^(GivenName|FamilyName|BirthDate|Contact)$")]
    public string Field { get; set; } = string.Empty;

    public bool Approve { get; set; }

    [StringLength(1000)]
    public string? Reason { get; set; } = null;
}
