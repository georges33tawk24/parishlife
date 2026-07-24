using ParishLive.Domain.Common;

namespace ParishLive.Domain.Entities;

/// <summary>
/// A record of an important action (spec §22): who did what, to which record, and when. Tenant-scoped;
/// the timestamp is the inherited CreatedAt. Written by <c>IAuditService</c> at key domain actions.
/// </summary>
public sealed class AuditLog : TenantEntity
{
    private AuditLog() { }

    public string ActorUserId { get; private set; } = string.Empty;
    public string Action { get; private set; } = string.Empty;
    public string EntityType { get; private set; } = string.Empty;
    public Guid? EntityId { get; private set; }
    public string Summary { get; private set; } = string.Empty;

    public static AuditLog Create(
        Guid orgId, Guid parishId, string actorUserId, string action, string entityType, Guid? entityId, string summary) => new()
    {
        OrgId = orgId,
        ParishId = parishId,
        ActorUserId = Guard.Required(actorUserId, "ActorUserId", 450),
        Action = Guard.Required(action, "Action", 200),
        EntityType = Guard.Required(entityType, "EntityType", 100),
        EntityId = entityId,
        Summary = Guard.Required(summary, "Summary", 1000)
    };
}
