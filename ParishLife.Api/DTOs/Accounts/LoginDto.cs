// Purpose: carries one username-or-email login identifier and the private password.
// Main members: Email, Password, Username; Validate requires exactly one login identifier.

using System.ComponentModel.DataAnnotations;
namespace ParishLife.Api.DTOs.Accounts;

public class LoginDto : IValidatableObject
{
    [EmailAddress]
    [StringLength(254)]
    public string? Email { get; set; }

    [Required]
    [StringLength(200)]
    public string Password { get; set; } = string.Empty;

    [StringLength(254)]
    public string? Username { get; set; } = null;

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (string.IsNullOrWhiteSpace(Email) == string.IsNullOrWhiteSpace(Username))
        {
            yield return new ValidationResult("Provide either an email address or a username.", [nameof(Email), nameof(Username)]);
        }
    }
}
