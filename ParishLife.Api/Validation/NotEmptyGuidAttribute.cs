// Purpose: rejects empty UUID input values while allowing omitted optional UUID properties.
// Main function: IsValid applies the same nonempty-identity boundary used by backend services during DTO validation.

using System.ComponentModel.DataAnnotations;

namespace ParishLife.Api.Validation;

[AttributeUsage(AttributeTargets.Property | AttributeTargets.Parameter)]
public class NotEmptyGuidAttribute : ValidationAttribute
{
    public NotEmptyGuidAttribute() : base("The {0} field must contain a nonempty UUID.")
    {
    }

    public override bool IsValid(object? value) => value is null || value is Guid id && id != Guid.Empty;
}
