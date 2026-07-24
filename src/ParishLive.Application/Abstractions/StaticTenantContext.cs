namespace ParishLive.Application.Abstractions;

/// <summary>
/// A fixed <see cref="ITenantContext"/> value — used for seeding, background jobs, and tests where there
/// is no signed-in user to resolve claims from.
/// </summary>
public sealed class StaticTenantContext : ITenantContext
{
    public StaticTenantContext(Guid orgId, IReadOnlyCollection<Guid> parishIds, bool isArchdioceseAdmin, string? userId = null)
    {
        OrgId = orgId;
        ParishIds = parishIds;
        IsArchdioceseAdmin = isArchdioceseAdmin;
        UserId = userId;
    }

    public string? UserId { get; }
    public Guid OrgId { get; }
    public IReadOnlyCollection<Guid> ParishIds { get; }
    public bool IsArchdioceseAdmin { get; }

    /// <summary>No tenant — sees nothing. Safe default for design-time / unauthenticated contexts.</summary>
    public static readonly ITenantContext None = new StaticTenantContext(Guid.Empty, Array.Empty<Guid>(), false);
}
