// Purpose: returns a campaign with totals derived from actual posted gifts, per currency.
// Main members: Id, Version, Name, NameAr, Purpose, PurposeAr, FundId, StartsOn, EndsOn, Targets, Received, Pledged and Status.

namespace ParishLife.Api.DTOs.Finance;

public class CampaignDto
{
    public string Id { get; set; } = string.Empty;

    public string Version { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string? NameAr { get; set; } = null;

    public string Purpose { get; set; } = string.Empty;

    public string? PurposeAr { get; set; } = null;

    public string FundId { get; set; } = string.Empty;

    public DateOnly StartsOn { get; set; }

    public DateOnly? EndsOn { get; set; } = null;

    public Dictionary<string, decimal> Targets { get; set; } = new();

    // Posted gifts net of reversals, by currency.
    public Dictionary<string, decimal> Received { get; set; } = new();

    // Active pledges, by currency; never counted as received.
    public Dictionary<string, decimal> Pledged { get; set; } = new();

    public string Status { get; set; } = string.Empty;
}
