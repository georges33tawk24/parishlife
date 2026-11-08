// Purpose: represents plan definition business state and rules.
// Main functions: Validate.

namespace ParishLife.Api.Models;

public class PlanDefinition
{
    public string Id { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public Money Price { get; set; } = new();

    public string[] Modules { get; set; } = Array.Empty<string>();

    public int TermMonths { get; set; }

    public DateTimeOffset PublishedAt { get; set; }

    public int Version { get; set; } = 1;

    public void Validate()
    {
        Guard.Text(Name, "Plan name");
        _ = Money.Create(Price.Amount, Price.Currency, Price.MinorUnits);
        if (TermMonths is < 1 or > 36 || Modules.Length == 0 || Modules.Distinct().Count() != Modules.Length || Modules.Any(x => !ProductModules.All.Contains(x)) || !Modules.Contains("core"))
            throw new DomainException("invalid_plan", "A plan must have a 1–36 month term and distinct known modules including core.");
    }
}
