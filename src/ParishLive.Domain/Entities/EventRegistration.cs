using ParishLive.Domain.Common;

namespace ParishLive.Domain.Entities;

/// <summary>A person's registration for an event (unique per event + user).</summary>
public sealed class EventRegistration : TenantEntity
{
    private EventRegistration() { }

    public Guid EventId { get; private set; }
    public string UserId { get; private set; } = string.Empty;

    public static EventRegistration Create(Guid orgId, Guid parishId, Guid eventId, string userId) => new()
    {
        OrgId = orgId,
        ParishId = parishId,
        EventId = Guard.NotEmpty(eventId, "EventId"),
        UserId = Guard.Required(userId, "UserId", 450)
    };
}
