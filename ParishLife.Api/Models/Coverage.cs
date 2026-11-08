// Purpose: represents coverage business state and rules.
// Main functions: Includes, Overlaps.

namespace ParishLife.Api.Models;

public class Coverage
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string InvoiceId { get; set; } = string.Empty;

    public string PlanId { get; set; } = string.Empty;

    public string[] Modules { get; set; } = Array.Empty<string>();

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset EndsAt { get; set; }

    public string BillingAccountId { get; set; } = string.Empty;

    public bool Includes(string module, DateTimeOffset now) => StartsAt <= now && now < EndsAt && Modules.Contains(module, StringComparer.Ordinal);
    public bool Overlaps(Coverage other) => StartsAt < other.EndsAt && other.StartsAt < EndsAt;
}
