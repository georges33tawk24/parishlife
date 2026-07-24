namespace ParishLive.Application.Abstractions;

/// <summary>
/// Request-scoped tenant context resolved from the signed-in user's claims. Consumed by the EF Core
/// global query filters, the SaveChanges guard, and permission checks (Part 7). Implemented in the
/// Infrastructure/Web layer.
/// </summary>
public interface ITenantContext
{
    string? UserId { get; }
    Guid OrgId { get; }
    IReadOnlyCollection<Guid> ParishIds { get; }
    bool IsArchdioceseAdmin { get; }
}
