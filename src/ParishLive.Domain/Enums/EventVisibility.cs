namespace ParishLive.Domain.Enums;

/// <summary>Who may see an event.</summary>
public enum EventVisibility
{
    Everyone,          // public visitors too
    Members,           // registered parish members
    SpecificGroups,
    Roles,
    Invited
}
