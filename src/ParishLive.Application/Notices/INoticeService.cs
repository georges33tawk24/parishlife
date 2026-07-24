using ParishLive.Domain.Enums;

namespace ParishLive.Application.Notices;

/// <summary>Publishing and reading parish notices. Publishing requires the notices.publish permission.</summary>
public interface INoticeService
{
    Task<IReadOnlyList<NoticeListItem>> ListRecentAsync(int take = 20, CancellationToken cancellationToken = default);

    Task<Guid> PublishAsync(PublishNoticeRequest request, string publisherUserId, CancellationToken cancellationToken = default);

    Task<bool> CanPublishAsync(string userId, CancellationToken cancellationToken = default);
}

public sealed record NoticeListItem(
    Guid Id, string Title, string Body, NoticePriority Priority, string PublishedBy, DateTimeOffset PublishedAtUtc);

public sealed record PublishNoticeRequest(
    string Title, string Body, NoticePriority Priority, NoticeAudience Audience, DateTimeOffset? ExpiresAtUtc);
