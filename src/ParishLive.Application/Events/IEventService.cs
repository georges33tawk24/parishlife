namespace ParishLive.Application.Events;

/// <summary>Event use-cases (read + member self-registration). Implemented in Infrastructure.</summary>
public interface IEventService
{
    Task<IReadOnlyList<EventListItem>> ListUpcomingAsync(string? currentUserId = null, int take = 50, CancellationToken cancellationToken = default);

    Task<int> CountUpcomingAsync(CancellationToken cancellationToken = default);

    Task<IReadOnlyList<EventListItem>> ListForMonthAsync(int year, int month, CancellationToken cancellationToken = default);

    Task<EventDetail?> GetAsync(Guid eventId, string? currentUserId, CancellationToken cancellationToken = default);

    Task RegisterAsync(Guid eventId, string userId, CancellationToken cancellationToken = default);
}

public sealed record EventListItem(
    Guid Id, string Title, string? GroupName, string? VenueName,
    DateTimeOffset StartUtc, DateTimeOffset EndUtc, int Registrations, int? Capacity,
    bool RegistrationOpen, bool IsRegistered);

public sealed record EventDetail(
    Guid Id, string Title, string? Description, string? GroupName, string? VenueName,
    DateTimeOffset StartUtc, DateTimeOffset EndUtc, int? Capacity, int Registrations,
    bool RegistrationOpen, bool IsRegistered);
