namespace ParishLive.Domain.Common;

/// <summary>
/// Base type for every tenant-scoped entity. OrgId (archdiocese) and ParishId (parish)
/// are the isolation keys enforced by the EF Core global query filters and the
/// SaveChanges guard in the Infrastructure layer (Part 7 of the build prompt).
/// ParishId is the real isolation key; OrgId enables archdiocese roll-ups.
/// </summary>
public abstract class TenantEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OrgId { get; set; }
    public Guid ParishId { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
