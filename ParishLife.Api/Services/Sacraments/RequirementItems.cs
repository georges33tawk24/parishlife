// Purpose: the shared validation of a sacrament preparation checklist, used for an archdiocese's list and a parish's own list alike.
// Main function: Validate (at most 30 items; each with a short alphanumeric key of its own and an English or Arabic label up to 200 characters).

using ParishLife.Api.DTOs.Sacraments;
using ParishLife.Api.Models;

namespace ParishLife.Api.Services.Sacraments;

public static class RequirementItems
{
    internal const int Maximum = 30;

    public static SacramentRequirement[] Validate(List<RequirementItemDto>? requested)
    {
        if (requested is null || requested.Count > Maximum)
            throw new DomainException("invalid_input", $"List up to {Maximum} requirements.");
        var items = requested.Select(i => new SacramentRequirement
        {
            Key = i.Key is { Length: >= 1 and <= 60 } k && k.All(c => char.IsAsciiLetterOrDigit(c) || c == '_')
                ? k : throw new DomainException("invalid_input", "Each requirement needs a short alphanumeric key."),
            Label = Optional(i.Label, "Requirement"), LabelAr = Optional(i.LabelAr, "Arabic requirement")
        }).ToArray();
        if (items.Any(i => i.Label is null && i.LabelAr is null))
            throw new DomainException("invalid_input", "Name each requirement in English or Arabic.");
        if (items.Select(i => i.Key).Distinct(StringComparer.Ordinal).Count() != items.Length)
            throw new DomainException("invalid_input", "Each requirement needs its own key.");
        return items;
    }

    private static string? Optional(string? value, string name) => string.IsNullOrWhiteSpace(value) ? null : Guard.Text(value, name, 200);
}
