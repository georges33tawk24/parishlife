using ParishLive.Domain.Enums;

namespace ParishLive.Domain.Entities;

/// <summary>
/// Links a user to a parish with a system role. The single table that drives every policy:
/// a user may hold different roles in different parishes. Read into claims at sign-in.
/// </summary>
public class Membership
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string UserId { get; set; } = string.Empty;
    public Guid OrgId { get; set; }
    public Guid ParishId { get; set; }
    public SystemRole Role { get; set; }
    public bool IsActive { get; set; } = true;
    public bool Accepted { get; set; } = true;
    public DateTimeOffset? StartsAtUtc { get; set; }
    public DateTimeOffset? EndsAtUtc { get; set; }
    public Guid? GroupId { get; set; }
    public bool IsHeadPriest { get; set; }
    public long Revision { get; set; } = 1;
    public bool CanReviewSensitiveConcerns { get; set; }
    public bool CanViewConcernIdentity { get; set; }
    public string? AppointedByUserId { get; set; }
    public string? AuthorityReference { get; set; }
    public DateTimeOffset? AcceptedAtUtc { get; set; }
    public bool MayCreateParishes { get; set; }
    public DateTimeOffset? InvitationExpiresAtUtc { get; set; }

    public bool IsEffective(DateTimeOffset now) => IsActive && Accepted &&
        (StartsAtUtc is null || StartsAtUtc <= now) && (EndsAtUtc is null || EndsAtUtc > now);
}
