// Purpose: represents a giving appeal with a purpose, fund, dates and optional genuine targets per currency.
// Main members: Id, ParishId, Name, Purpose, FundId, StartsOn, EndsOn, Targets, Status and creation facts.

namespace ParishLife.Api.Models;

public class Campaign
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string Purpose { get; set; } = string.Empty;

    public string FundId { get; set; } = string.Empty;

    public DateOnly StartsOn { get; set; }

    public DateOnly? EndsOn { get; set; } = null;

    // Optional genuine targets keyed by currency; none is invented.
    public Dictionary<string, decimal> Targets { get; set; } = new();

    // Active or Ended.
    public string Status { get; set; } = "Active";

    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }
}
