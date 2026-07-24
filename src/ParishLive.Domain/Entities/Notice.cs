using ParishLive.Domain.Common;
using ParishLive.Domain.Enums;

namespace ParishLive.Domain.Entities;

/// <summary>
/// A parish notice / announcement. Tenant-scoped, encapsulated. Carries a body, priority, target
/// audience, publisher, and optional expiry (so stale notices drop off automatically).
/// </summary>
public sealed class Notice : TenantEntity
{
    private Notice() { }

    public string Title { get; private set; } = string.Empty;
    public string Body { get; private set; } = string.Empty;
    public NoticePriority Priority { get; private set; }
    public NoticeAudience Audience { get; private set; }
    public string PublishedByUserId { get; private set; } = string.Empty;
    public DateTimeOffset PublishedAtUtc { get; private set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? ExpiresAtUtc { get; private set; }

    public bool IsExpired => ExpiresAtUtc is { } expiry && expiry < DateTimeOffset.UtcNow;

    public static Notice Create(
        Guid orgId, Guid parishId, string title, string body, NoticePriority priority,
        NoticeAudience audience, string publishedByUserId, DateTimeOffset? expiresAtUtc) => new()
    {
        OrgId = orgId,
        ParishId = parishId,
        Title = Guard.Required(title, "Title", 300),
        Body = Guard.Required(body, "Body", 8000),
        Priority = priority,
        Audience = audience,
        PublishedByUserId = Guard.Required(publishedByUserId, "PublishedByUserId", 450),
        PublishedAtUtc = DateTimeOffset.UtcNow,
        ExpiresAtUtc = expiresAtUtc
    };
}
