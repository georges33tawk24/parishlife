namespace ParishLive.Application.Audit;

/// <summary>
/// Records and reads the audit trail (spec §22). Writes happen at key domain actions (reservation
/// decisions, notice publishing); reading requires the audit.view permission.
/// </summary>
public interface IAuditService
{
    /// <summary>Record one action. Uses the current tenant context for org/parish; a no-op if there is none.</summary>
    Task LogAsync(string action, string entityType, Guid? entityId, string summary, string actorUserId, CancellationToken cancellationToken = default);

    /// <summary>Most-recent entries for the current parish. Throws <c>ForbiddenException</c> without audit.view.</summary>
    Task<IReadOnlyList<AuditEntry>> ListRecentAsync(int take = 100, CancellationToken cancellationToken = default);

    Task<bool> CanViewAsync(string userId, CancellationToken cancellationToken = default);
}

public sealed record AuditEntry(
    string Actor, string Action, string EntityType, string Summary, DateTimeOffset OccurredAtUtc);
