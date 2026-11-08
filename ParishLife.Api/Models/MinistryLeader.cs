// Purpose: represents ministry leader business state and rules.
// Main functions: Current.

namespace ParishLife.Api.Models;

public class MinistryLeader
{
    public string Id { get; set; } = string.Empty;

    public string MinistryId { get; set; } = string.Empty;

    public string AccountId { get; set; } = string.Empty;

    public string Role { get; set; } = string.Empty;

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset? EndsAt { get; set; }

    public bool Revoked { get; set; }

    public string AppointedBy { get; set; } = string.Empty;

    public string EvidenceReference { get; set; } = string.Empty;

    public bool Current(DateTimeOffset now) => !Revoked && StartsAt <= now && (EndsAt is null || now < EndsAt);
}
