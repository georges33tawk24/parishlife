using ParishLive.Domain.Common;

namespace ParishLive.Domain.Entities;

/// <summary>A reservable parish location (hall, theatre, room…). Tenant-scoped.</summary>
public sealed class Venue : TenantEntity
{
    public long Revision { get; set; } = 1;
    public int SetupMinutes { get; set; }
    public int CleanupMinutes { get; set; }
    public bool IsServiceable { get; set; } = true;
    private Venue() { }

    public string Name { get; private set; } = string.Empty;
    public int Capacity { get; private set; }
    public bool IsActive { get; private set; } = true;

    public static Venue Create(Guid orgId, Guid parishId, string name, int capacity) => new()
    {
        OrgId = orgId,
        ParishId = parishId,
        Name = Guard.Required(name, "Name", 200),
        Capacity = Guard.Positive(capacity, "Capacity"),
        IsActive = true
    };
}
