using ParishLive.Domain.Common;
using ParishLive.Domain.Enums;

namespace ParishLive.Domain.Entities;

/// <summary>
/// A parish event (Mass, feast, camp, meeting…). Tenant-scoped. An optional organizing group and venue,
/// an optional capacity, and a visibility. Registrations are tracked via <see cref="EventRegistration"/>.
/// </summary>
public sealed class Event : TenantEntity
{
    private Event() { }

    public string Title { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public Guid? GroupId { get; private set; }
    public Guid? VenueId { get; private set; }
    public DateTimeOffset StartUtc { get; private set; }
    public DateTimeOffset EndUtc { get; private set; }
    public int? Capacity { get; private set; }
    public EventVisibility Visibility { get; private set; }
    public bool RegistrationOpen { get; private set; }

    public static Event Create(
        Guid orgId, Guid parishId, string title, string? description, Guid? groupId, Guid? venueId,
        DateTimeOffset startUtc, DateTimeOffset endUtc, int? capacity, EventVisibility visibility, bool registrationOpen)
    {
        if (endUtc <= startUtc)
            throw new DomainException("The event must end after it starts.");
        if (capacity is not null)
            Guard.Positive(capacity.Value, "Capacity");

        return new Event
        {
            OrgId = orgId,
            ParishId = parishId,
            Title = Guard.Required(title, "Title", 300),
            Description = Guard.Optional(description, "Description", 4000),
            GroupId = groupId,
            VenueId = venueId,
            StartUtc = startUtc,
            EndUtc = endUtc,
            Capacity = capacity,
            Visibility = visibility,
            RegistrationOpen = registrationOpen
        };
    }
}
