// Purpose: carries one proposed field change, and in responses its old value and decision.
// Main members: Field, NewValue, Evidence, OldValue, Decision and Reason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.People;

public class ProfileCorrectionFieldDto
{
    [Required]
    [RegularExpression("^(GivenName|FamilyName|BirthDate|Contact)$")]
    public string Field { get; set; } = string.Empty;

    [Required]
    [StringLength(300)]
    public string NewValue { get; set; } = string.Empty;

    [StringLength(1000)]
    public string? Evidence { get; set; } = null;

    public string? OldValue { get; set; } = null;

    public string? Decision { get; set; } = null;

    public string? Reason { get; set; } = null;
}
