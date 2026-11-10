// Purpose: represents a promised gift and schedule; it never authorizes charging anyone.
// Main members: Id, ParishId, PersonId, HouseholdId, FundId, CampaignId, Amount, Currency, Schedule, StartsOn, EndsOn, Status and creation facts.

namespace ParishLife.Api.Models;

public class Pledge
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string? PersonId { get; set; } = null;

    public string? HouseholdId { get; set; } = null;

    public string FundId { get; set; } = string.Empty;

    public string? CampaignId { get; set; } = null;

    public decimal Amount { get; set; }

    public string Currency { get; set; } = string.Empty;

    public string? Schedule { get; set; } = null;

    public DateOnly StartsOn { get; set; }

    public DateOnly? EndsOn { get; set; } = null;

    // Active, Fulfilled or Cancelled.
    public string Status { get; set; } = "Active";

    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }
}
