using ParishLive.Domain.Common;
using ParishLive.Domain.Enums;

namespace ParishLive.Domain.Entities;

/// <summary>
/// A person's membership of a group with a committee role and a term. A person may have several
/// GroupMember rows at once (different groups/roles). Committee terms carry start/end dates so past
/// committees stay in the historical record — a row is "current" when <see cref="EndDate"/> is null.
/// </summary>
public class GroupMember : TenantEntity
{
    public Guid GroupId { get; set; }
    public string UserId { get; set; } = string.Empty;
    public CommitteeRole Role { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly? EndDate { get; set; }

    public bool IsCurrent => EndDate is null;
}
