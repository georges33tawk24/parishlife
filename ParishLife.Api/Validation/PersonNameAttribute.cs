// Purpose: rejects a person-name input that contains digits, symbols or letters of the other script, during DTO validation.
// Main members: Arabic (true for the Arabic name twins) and IsValid, which applies PersonRules.NameProblem so the request is refused
// with the same message the service would give.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Services.People;

namespace ParishLife.Api.Validation;

[AttributeUsage(AttributeTargets.Property)]
public class PersonNameAttribute : ValidationAttribute
{
    public bool Arabic { get; set; }

    protected override ValidationResult? IsValid(object? value, ValidationContext validationContext)
    {
        var problem = PersonRules.NameProblem(value as string, validationContext.DisplayName, Arabic);
        return problem is null ? ValidationResult.Success : new ValidationResult(problem, [validationContext.MemberName ?? validationContext.DisplayName]);
    }
}
