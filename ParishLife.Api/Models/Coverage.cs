// Purpose: represents coverage business state and rules. Coverage comes from a paid invoice, or is free (Complimentary) when a ParishLife
// operator grants it (owner decision, 23 November 2026); both unlock modules the same way.
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

    public bool Complimentary { get; set; }

    public string? GrantedBy { get; set; }

    public string? GrantReason { get; set; }

    // Free coverage without an end date runs until this far-future instant.
    public static readonly DateTimeOffset NoEnd = new(9999, 12, 31, 0, 0, 0, TimeSpan.Zero);

    public bool Includes(string module, DateTimeOffset now) => StartsAt <= now && now < EndsAt && Modules.Contains(module, StringComparer.Ordinal);
    public bool Overlaps(Coverage other) => StartsAt < other.EndsAt && other.StartsAt < EndsAt;
}
