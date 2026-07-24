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
}
