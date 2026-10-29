using Microsoft.EntityFrameworkCore;
using ParishLive.Application.Events;
using ParishLive.Domain.Common;
using ParishLive.Domain.Entities;
using ParishLive.Application.Abstractions;
using ParishLive.Application.Common;
using ParishLive.Domain.Enums;
using ParishLive.Infrastructure.Operations;
using ParishLive.Infrastructure.Data;

namespace ParishLive.Infrastructure.Events;

/// <summary>
/// Event reads and member self-registration. Tenant-scoped via the DbContext filters. Date comparisons
/// and ordering are done client-side because SQLite (dev/test) can't compare/ORDER BY DateTimeOffset;
/// event sets are small and parish-bounded. Portable to PostgreSQL, which does it in SQL.
/// </summary>
public sealed class EventService(AppDbContext db, ITenantContext tenant, EventAdmissionService admissions) : IEventService
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
        if (!await CanViewAsync(e)) return null;

        var groupName = e.GroupId is Guid gid ? await db.Groups.Where(g => g.Id == gid).Select(g => g.Name).FirstOrDefaultAsync(cancellationToken) : null;
        var venueName = e.VenueId is Guid vid ? await db.Venues.Where(v => v.Id == vid).Select(v => v.Name).FirstOrDefaultAsync(cancellationToken) : null;
        var registrations = await OccupiedAsync(eventId);
        var isRegistered = currentUserId is not null && (await db.EventRegistrations.AnyAsync(r => r.EventId == eventId && r.UserId == currentUserId, cancellationToken) ||
            await db.EventAdmissions.AnyAsync(r => r.EventId == eventId && r.ParticipantUserId == currentUserId && r.Place != PlaceStatus.Cancelled, cancellationToken));

        return new EventDetail(e.Id, e.Title, e.Description, groupName, venueName,
            e.StartUtc, e.EndUtc, e.Capacity, registrations, e.RegistrationOpen, isRegistered);
    }

    public async Task RegisterAsync(Guid eventId, string userId, CancellationToken cancellationToken = default)
    {
        if (userId != tenant.UserId) throw new ForbiddenException("Error.Unavailable");
        var e = await db.Events.SingleOrDefaultAsync(e => e.Id == eventId, cancellationToken);
        if (e is null || !await CanViewAsync(e)) throw new ForbiddenException("Error.Unavailable");
        // The old one-click path now requests a place; it never fabricates age, consent or confirmation.
        await admissions.ReserveAsync(eventId, userId, null, Guid.NewGuid());
    }

    private async Task<List<EventListItem>> LoadAsync(string? currentUserId, CancellationToken cancellationToken)
    {
        var candidates = await db.Events.AsNoTracking().ToListAsync(cancellationToken);
        var events = new List<Event>();
        foreach (var e in candidates) if (await CanViewAsync(e)) events.Add(e);

        var groupNames = await db.Groups.ToDictionaryAsync(g => g.Id, g => g.Name, cancellationToken);
        var venueNames = await db.Venues.ToDictionaryAsync(v => v.Id, v => v.Name, cancellationToken);
        var counts = new Dictionary<Guid, int>();
        foreach (var e in events) counts[e.Id] = await OccupiedAsync(e.Id);
        var registered = currentUserId is null
            ? new HashSet<Guid>()
            : (await db.EventRegistrations.Where(r => r.UserId == currentUserId).Select(r => r.EventId).ToListAsync(cancellationToken)).ToHashSet();

        if (currentUserId is not null)
            registered.UnionWith(await db.EventAdmissions.Where(a => a.ParticipantUserId == currentUserId && a.Place != PlaceStatus.Cancelled)
                .Select(a => a.EventId).ToListAsync(cancellationToken));
        return events.Select(e => new EventListItem(
            e.Id, e.Title,
            e.GroupId is Guid gid && groupNames.TryGetValue(gid, out var gn) ? gn : null,
            e.VenueId is Guid vid && venueNames.TryGetValue(vid, out var vn) ? vn : null,
            e.StartUtc, e.EndUtc, counts.GetValueOrDefault(e.Id), e.Capacity,
            e.RegistrationOpen, registered.Contains(e.Id))).ToList();
    }

    private async Task<int> OccupiedAsync(Guid eventId)
    {
        var all = await db.EventAdmissions.Where(a => a.EventId == eventId).ToListAsync();
        var legacy = await db.EventRegistrations.Where(r => r.EventId == eventId).Select(r => r.UserId).ToListAsync();
        return all.Where(a => a.Place is PlaceStatus.Reserved or PlaceStatus.Confirmed or PlaceStatus.NeedsReconfirmation)
            .Select(a => a.ParticipantUserId).Concat(legacy.Where(id => all.All(a => a.ParticipantUserId != id))).Distinct().Count();
    }

    private async Task<bool> CanViewAsync(Event item)
    {
        if (item.Visibility == EventVisibility.Everyone) return true;
        if (tenant.UserId is null) return false;
        var memberships = await db.Memberships.AsNoTracking().Where(m => m.UserId == tenant.UserId && m.ParishId == item.ParishId).ToListAsync();
        var current = memberships.Where(m => m.IsEffective(DateTimeOffset.UtcNow)).ToList();
        if (current.Count == 0) return false;
        var staff = tenant.ActingRole is "Priest" or "Secretary" or "ParishAdmin";
        if (staff) return true;
        if (item.Visibility == EventVisibility.Members) return true;
        if (item.Visibility == EventVisibility.SpecificGroups && item.GroupId is Guid group)
            return await db.GroupMembers.AnyAsync(m => m.GroupId == group && m.UserId == tenant.UserId && m.EndDate == null);
        if (item.Visibility == EventVisibility.Invited)
            return await db.EventRegistrations.AnyAsync(r => r.EventId == item.Id && r.UserId == tenant.UserId);
        return false;
    }
}
