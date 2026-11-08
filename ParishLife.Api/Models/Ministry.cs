// Purpose: represents ministry business state and rules.
// Main members: Id, ParishId, Name, Kind, Purpose, Status, PublicListed, and related workflow details.

namespace ParishLife.Api.Models;

public class Ministry
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string Kind { get; set; } = string.Empty;

    public string Purpose { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public bool PublicListed { get; set; }

    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public string? EligibilityPolicyReference { get; set; } = null;
}
