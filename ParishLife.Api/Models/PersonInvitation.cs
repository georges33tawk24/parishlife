// Purpose: represents an office-issued, single-use invitation that lets one account claim the link to one existing Person.
// Main members: Id, ParishId, PersonId, TokenHash, Status, Delivery, CreatedBy, CreatedAt, ExpiresAt, UsedByAccountId, UsedAt and ReviewReason.

namespace ParishLife.Api.Models;

public class PersonInvitation
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string PersonId { get; set; } = string.Empty;

    public string TokenHash { get; set; } = string.Empty;

    // Open, Used, Revoked or NeedsReview; expiry is derived from ExpiresAt.
    public string Status { get; set; } = "Open";

    // No delivery channel is configured, so the office hands the link over itself.
    public string Delivery { get; set; } = "NotSent";

    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset ExpiresAt { get; set; }

    public string? UsedByAccountId { get; set; }

    public DateTimeOffset? UsedAt { get; set; }

    public string? ReviewReason { get; set; }
}
