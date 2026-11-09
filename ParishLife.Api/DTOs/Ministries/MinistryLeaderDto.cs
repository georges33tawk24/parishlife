// Purpose: returns the authorized ministry leadership view with actual dates and effective availability.
// Main members: appointment identity, role, dates, Effective and privileged-only evidence/ending reason.

namespace ParishLife.Api.DTOs.Ministries;

public class MinistryLeaderDto
{
    public string Id { get; set; } = string.Empty;

    public string MinistryId { get; set; } = string.Empty;

    public string AccountId { get; set; } = string.Empty;

    public string[] Duties { get; set; } = Array.Empty<string>();

    public string Role { get; set; } = string.Empty;

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset? EndsAt { get; set; }

    public bool Revoked { get; set; }

    public bool Effective { get; set; }

    public string AppointedBy { get; set; } = string.Empty;

    public DateTimeOffset AppointedAt { get; set; }

    public DateTimeOffset? EndedAt { get; set; }

    public string? EndedBy { get; set; }

    public string? ReplacesAccountId { get; set; }

    public string? EvidenceReference { get; set; }

    public string? EndReason { get; set; }
}
