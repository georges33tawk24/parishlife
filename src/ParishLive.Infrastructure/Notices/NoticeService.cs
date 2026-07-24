using Microsoft.EntityFrameworkCore;
using ParishLive.Application.Abstractions;
using ParishLive.Application.Audit;
using ParishLive.Application.Authorization;
using ParishLive.Application.Notices;
using ParishLive.Domain.Common;
using ParishLive.Domain.Constants;
using ParishLive.Domain.Entities;
using ParishLive.Infrastructure.Data;

namespace ParishLive.Infrastructure.Notices;

public sealed class NoticeService(AppDbContext db, ITenantContext tenant, IPermissionService permissions, IAuditService audit) : INoticeService
{
    public async Task<IReadOnlyList<NoticeListItem>> ListRecentAsync(int take = 20, CancellationToken cancellationToken = default)
    {
        var notices = await db.Notices
            .Select(n => new { n.Id, n.Title, n.Body, n.Priority, n.PublishedByUserId, n.PublishedAtUtc, n.ExpiresAtUtc })
            .ToListAsync(cancellationToken);

        var publisherNames = await db.Users.ToDictionaryAsync(u => u.Id, u => u.DisplayName ?? u.Email!, cancellationToken);

        var now = DateTimeOffset.UtcNow;
        return notices
            .Where(n => n.ExpiresAtUtc is null || n.ExpiresAtUtc >= now)
            .OrderByDescending(n => n.PublishedAtUtc)                 // client-side: SQLite can't ORDER BY DateTimeOffset
            .Take(take)
            .Select(n => new NoticeListItem(
                n.Id, n.Title, n.Body, n.Priority,
                publisherNames.GetValueOrDefault(n.PublishedByUserId, ""), n.PublishedAtUtc))
            .ToList();
    }

    public async Task<Guid> PublishAsync(PublishNoticeRequest request, string publisherUserId, CancellationToken cancellationToken = default)
    {
        var parishId = tenant.ParishIds.FirstOrDefault();
        if (parishId == Guid.Empty)
            throw new DomainException("No parish context for the notice.");

        await permissions.RequireAsync(publisherUserId, parishId, PermissionCodes.Notices.Publish, cancellationToken);

        var notice = Notice.Create(tenant.OrgId, parishId, request.Title, request.Body,
            request.Priority, request.Audience, publisherUserId, request.ExpiresAtUtc);

        db.Notices.Add(notice);
        await db.SaveChangesAsync(cancellationToken);

        await audit.LogAsync("notice.publish", "Notice", notice.Id,
            $"Published notice: {notice.Title}", publisherUserId, cancellationToken);
        return notice.Id;
    }

    public async Task<bool> CanPublishAsync(string userId, CancellationToken cancellationToken = default)
    {
        var parishId = tenant.ParishIds.FirstOrDefault();
        return parishId != Guid.Empty && await permissions.HasAsync(userId, parishId, PermissionCodes.Notices.Publish, cancellationToken);
    }
}
