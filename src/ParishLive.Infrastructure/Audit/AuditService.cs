using Microsoft.EntityFrameworkCore;
using ParishLive.Application.Abstractions;
using ParishLive.Application.Audit;
using ParishLive.Application.Authorization;
using ParishLive.Domain.Constants;
using ParishLive.Domain.Entities;
using ParishLive.Infrastructure.Data;

namespace ParishLive.Infrastructure.Audit;

public sealed class AuditService(AppDbContext db, ITenantContext tenant, IPermissionService permissions) : IAuditService
{
    public async Task LogAsync(string action, string entityType, Guid? entityId, string summary, string actorUserId, CancellationToken cancellationToken = default)
    {
        var parishId = tenant.ParishIds.FirstOrDefault();
        if (parishId == Guid.Empty) return; // no parish context (e.g. seeding) — nothing to attribute the action to

        db.AuditLogs.Add(AuditLog.Create(tenant.OrgId, parishId, actorUserId, action, entityType, entityId, summary));
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<AuditEntry>> ListRecentAsync(int take = 100, CancellationToken cancellationToken = default)
    {
        var userId = tenant.UserId;
        var parishId = tenant.ParishIds.FirstOrDefault();
        if (userId is null || parishId == Guid.Empty) return [];

        await permissions.RequireAsync(userId, parishId, PermissionCodes.Audit.View, cancellationToken);

        var logs = await db.AuditLogs
            .Select(a => new { a.ActorUserId, a.Action, a.EntityType, a.Summary, a.CreatedAt })
            .ToListAsync(cancellationToken);

        var names = await db.Users.ToDictionaryAsync(u => u.Id, u => u.DisplayName ?? u.Email!, cancellationToken);

        return logs
            .OrderByDescending(a => a.CreatedAt)                      // client-side: SQLite can't ORDER BY DateTimeOffset
            .Take(take)
            .Select(a => new AuditEntry(
                names.GetValueOrDefault(a.ActorUserId, a.ActorUserId), a.Action, a.EntityType, a.Summary, a.CreatedAt))
            .ToList();
    }

    public async Task<bool> CanViewAsync(string userId, CancellationToken cancellationToken = default)
    {
        var parishId = tenant.ParishIds.FirstOrDefault();
        return parishId != Guid.Empty && await permissions.HasAsync(userId, parishId, PermissionCodes.Audit.View, cancellationToken);
    }
}
