using Microsoft.EntityFrameworkCore;
using ParishLive.Application.Events;
using ParishLive.Domain.Common;
using ParishLive.Domain.Entities;
using ParishLive.Infrastructure.Data;

namespace ParishLive.Infrastructure.Events;

/// <summary>
/// Event reads and member self-registration. Tenant-scoped via the DbContext filters. Date comparisons
/// and ordering are done client-side because SQLite (dev/test) can't compare/ORDER BY DateTimeOffset;
/// event sets are small and parish-bounded. Portable to PostgreSQL, which does it in SQL.
/// </summary>
public sealed class EventService(AppDbContext db) : IEventService
{
    public async Task<IReadOnlyList<EventListItem>> ListUpcomingAsync(string? currentUserId = null, int take = 50, CancellationToken cancellationToken = default)
    {
        var now = DateTimeOffset.UtcNow;
        var events = await LoadAsync(currentUserId, cancellationToken);
        return events.Where(e => e.EndUtc >= now).OrderBy(e => e.StartUtc).Take(take).ToList();
    }

    public async Task<int> CountUpcomingAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTimeOffset.UtcNow;
        var events = await LoadAsync(null, cancellationToken);
        return events.Count(e => e.EndUtc >= now);
    }

    public async Task<IReadOnlyList<EventListItem>> ListForMonthAsync(int year, int month, CancellationToken cancellationToken = default)
    {
        var events = await LoadAsync(null, cancellationToken);
        return events
            .Where(e => e.StartUtc.Year == year && e.StartUtc.Month == month)
            .OrderBy(e => e.StartUtc)
            .ToList();
    }

    public async Task<EventDetail?> GetAsync(Guid eventId, string? currentUserId, CancellationToken cancellationToken = default)
    {
        var e = await db.Events.FirstOrDefaultAsync(x => x.Id == eventId, cancellationToken);
        if (e is null)
            return null;

        var groupName = e.GroupId is Guid gid ? await db.Groups.Where(g => g.Id == gid).Select(g => g.Name).FirstOrDefaultAsync(cancellationToken) : null;
        var venueName = e.VenueId is Guid vid ? await db.Venues.Where(v => v.Id == vid).Select(v => v.Name).FirstOrDefaultAsync(cancellationToken) : null;
        var registrations = await db.EventRegistrations.CountAsync(r => r.EventId == eventId, cancellationToken);
        var isRegistered = currentUserId is not null && await db.EventRegistrations.AnyAsync(r => r.EventId == eventId && r.UserId == currentUserId, cancellationToken);

        return new EventDetail(e.Id, e.Title, e.Description, groupName, venueName,
            e.StartUtc, e.EndUtc, e.Capacity, registrations, e.RegistrationOpen, isRegistered);
    }

    public async Task RegisterAsync(Guid eventId, string userId, CancellationToken cancellationToken = default)
    {
        var e = await db.Events.FirstOrDefaultAsync(x => x.Id == eventId, cancellationToken)
            ?? throw new DomainException("Event not found.");

        if (!e.RegistrationOpen)
            throw new DomainException("Registration for this event is closed.");

        if (await db.EventRegistrations.AnyAsync(r => r.EventId == eventId && r.UserId == userId, cancellationToken))
            return; // already registered — idempotent

        if (e.Capacity is int capacity)
        {
            var count = await db.EventRegistrations.CountAsync(r => r.EventId == eventId, cancellationToken);
            if (count >= capacity)
                throw new DomainException("This event is full.");
        }

        db.EventRegistrations.Add(EventRegistration.Create(e.OrgId, e.ParishId, eventId, userId));
        await db.SaveChangesAsync(cancellationToken);
    }

    private async Task<List<EventListItem>> LoadAsync(string? currentUserId, CancellationToken cancellationToken)
    {
        var events = await db.Events
            .Select(e => new { e.Id, e.Title, e.GroupId, e.VenueId, e.StartUtc, e.EndUtc, e.Capacity, e.RegistrationOpen })
            .ToListAsync(cancellationToken);

        var groupNames = await db.Groups.ToDictionaryAsync(g => g.Id, g => g.Name, cancellationToken);
        var venueNames = await db.Venues.ToDictionaryAsync(v => v.Id, v => v.Name, cancellationToken);
        var counts = (await db.EventRegistrations
                .GroupBy(r => r.EventId)
                .Select(x => new { EventId = x.Key, Count = x.Count() })
                .ToListAsync(cancellationToken))
            .ToDictionary(x => x.EventId, x => x.Count);
        var registered = currentUserId is null
            ? new HashSet<Guid>()
            : (await db.EventRegistrations.Where(r => r.UserId == currentUserId).Select(r => r.EventId).ToListAsync(cancellationToken)).ToHashSet();

        return events.Select(e => new EventListItem(
            e.Id, e.Title,
            e.GroupId is Guid gid && groupNames.TryGetValue(gid, out var gn) ? gn : null,
            e.VenueId is Guid vid && venueNames.TryGetValue(vid, out var vn) ? vn : null,
            e.StartUtc, e.EndUtc, counts.GetValueOrDefault(e.Id), e.Capacity,
            e.RegistrationOpen, registered.Contains(e.Id))).ToList();
    }
}
