// Purpose: returns the explicit authorized PlanDefinition response fields without binding the persistence model.
// Main members: response properties; From maps the allowed fields and copies exposed collections.

using ParishLife.Api.Models;

namespace ParishLife.Api.DTOs.Billing;

public class PlanDto
{
    public string Id { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public MoneyDto Price { get; set; } = new();

    public string[] Modules { get; set; } = Array.Empty<string>();

    public int TermMonths { get; set; }

    public DateTimeOffset PublishedAt { get; set; }

    public int Version { get; set; } = 1;

    public static PlanDto From(PlanDefinition value)
    {
        return new PlanDto
        {
            Id = value.Id,
            Name = value.Name,
            Price = MoneyDto.From(value.Price),
            Modules = [.. value.Modules],
            TermMonths = value.TermMonths,
            PublishedAt = value.PublishedAt,
            Version = value.Version
        };
    }
}
