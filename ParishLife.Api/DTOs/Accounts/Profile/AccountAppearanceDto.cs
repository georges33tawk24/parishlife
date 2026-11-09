// Purpose: defines the constrained personal appearance choices accepted and returned by the account API.
// Main members: Mode selects light/dark; Scheme selects a retained preset or custom; PrimaryColor is a six-digit color, never arbitrary CSS.

using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace ParishLife.Api.DTOs.Accounts.Profile;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public class AccountAppearanceDto
{
    [Required]
    [RegularExpression("^(light|dark)$")]
    public string Mode { get; set; } = "light";

    [Required]
    [RegularExpression("^(forest|navy|marian|burgundy|purple|teal|cedar|slate|custom)$")]
    public string Scheme { get; set; } = "forest";

    [RegularExpression("^#[0-9A-Fa-f]{6}$")]
    public string? PrimaryColor { get; set; }
}
