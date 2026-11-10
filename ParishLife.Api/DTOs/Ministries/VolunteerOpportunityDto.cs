// Purpose: returns a volunteer opportunity with its remaining places and no volunteer identities.
// Main members: Id, MinistryId, Title, Position, Requirements, Location, StartsAt, EndsAt, Capacity, Remaining, Status and SelfSignup.

namespace ParishLife.Api.DTOs.Ministries;

public class VolunteerOpportunityDto
{
    public string Id { get; set; } = string.Empty;

    public string MinistryId { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string Position { get; set; } = string.Empty;

    public string? Requirements { get; set; } = null;

    public string? Location { get; set; } = null;

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset EndsAt { get; set; }

    public int Capacity { get; set; }

    public int Remaining { get; set; }

    public string Status { get; set; } = string.Empty;

    public bool SelfSignup { get; set; }
}
