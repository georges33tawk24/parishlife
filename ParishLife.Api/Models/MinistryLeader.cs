// Purpose: represents ministry leader business state and rules.
// Main functions: Current checks the dated appointment; appointment and ending metadata preserve the actual authority history.

namespace ParishLife.Api.Models;

public class MinistryLeader
{
    public string Id { get; set; } = string.Empty;

    public string MinistryId { get; set; } = string.Empty;

    public string AccountId { get; set; } = string.Empty;

    public string[] Duties { get; set; } = Array.Empty<string>();

    public string Role { get; set; } = string.Empty;

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset? EndsAt { get; set; }

    public bool Revoked { get; set; }

    public string AppointedBy { get; set; } = string.Empty;

    public string EvidenceReference { get; set; } = string.Empty;

    public DateTimeOffset AppointedAt { get; set; }

    public DateTimeOffset? EndedAt { get; set; }

    public string? EndedBy { get; set; }

    public string? EndReason { get; set; }

    public string? ReplacesAccountId { get; set; }

    public bool Current(DateTimeOffset now) => !Revoked && EndedAt is null && StartsAt <= now
        && AppointedAt <= now && (EndsAt is null || now < EndsAt);
}
