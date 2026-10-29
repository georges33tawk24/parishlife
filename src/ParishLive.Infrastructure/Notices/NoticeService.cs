using Microsoft.EntityFrameworkCore;
using ParishLive.Application.Abstractions;
using ParishLive.Application.Audit;
using ParishLive.Application.Authorization;
using ParishLive.Application.Notices;
using ParishLive.Domain.Common;
using ParishLive.Domain.Constants;
using ParishLive.Domain.Entities;
using ParishLive.Domain.Enums;
using ParishLive.Application.Common;
using ParishLive.Infrastructure.Data;

namespace ParishLive.Infrastructure.Notices;

public sealed class NoticeService(AppDbContext db, ITenantContext tenant, IPermissionService permissions, IAuditService audit) : INoticeService
{
    public async Task<IReadOnlyList<NoticeListItem>> ListRecentAsync(int take = 20, CancellationToken cancellationToken = default)
    {
        var appointments = (await db.Memberships.AsNoTracking().Where(m => m.UserId == tenant.UserId).ToListAsync(cancellationToken))
            .Where(m => m.IsEffective(DateTimeOffset.UtcNow)).ToList();
        var staffParishes = appointments.Where(m => m.Role.ToString() == tenant.ActingRole &&
            (tenant.ActingAssignmentId is null || m.Id == tenant.ActingAssignmentId) && m.Role is SystemRole.Priest or SystemRole.Secretary or SystemRole.ParishAdmin)
            .Select(m => m.ParishId).ToArray();
        var memberParishes = appointments.Select(m => m.ParishId).ToArray();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var committeeParishes = await db.GroupMembers.Where(m => m.UserId == tenant.UserId && m.EndDate == null &&
            m.StartDate <= today && m.Role != CommitteeRole.RegularMember).Select(m => m.ParishId).ToListAsync(cancellationToken);
        var notices = await db.Notices.Where(n => n.Audience == NoticeAudience.Everyone || staffParishes.Contains(n.ParishId) ||
                n.Audience == NoticeAudience.Members && memberParishes.Contains(n.ParishId) ||
                n.Audience == NoticeAudience.Committees && committeeParishes.Contains(n.ParishId))
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
        if (publisherUserId != tenant.UserId) throw new ForbiddenException("Error.Unavailable");
        var parishId = tenant.ParishIds.FirstOrDefault();
        if (parishId == Guid.Empty)
            throw new DomainException("No parish context for the notice.");

        await permissions.RequireAsync(publisherUserId, parishId, PermissionCodes.Notices.Publish, cancellationToken);

        var notice = Notice.Create(tenant.OrgId, parishId, request.Title, request.Body,
            request.Priority, request.Audience, publisherUserId, request.ExpiresAtUtc);

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        db.Notices.Add(notice);
        await db.SaveChangesAsync(cancellationToken);

        await audit.LogAsync("notice.publish", "Notice", notice.Id,
            $"Published notice: {notice.Title}", publisherUserId, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return notice.Id;
    }

    public async Task<bool> CanPublishAsync(string userId, CancellationToken cancellationToken = default)
    {
        var parishId = tenant.ParishIds.FirstOrDefault();
        return parishId != Guid.Empty && await permissions.HasAsync(userId, parishId, PermissionCodes.Notices.Publish, cancellationToken);
    }
}
