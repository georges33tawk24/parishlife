// Purpose: represents one ministry volunteer position on a dated slot with real capacity.
// Main members: Id, ParishId, MinistryId, Title/TitleAr, Position, Requirements, Location, StartsAt, EndsAt, Capacity, Confirmed, Status, SelfSignup and creation facts.

namespace ParishLife.Api.Models;

public class VolunteerOpportunity
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string MinistryId { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string? TitleAr { get; set; } = null;

    public string Position { get; set; } = string.Empty;

    public string? Requirements { get; set; } = null;

    public string? Location { get; set; } = null;

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset EndsAt { get; set; }

    public int Capacity { get; set; }

    // Confirmed commitments; changed only in the same transaction as the assignment.
    public int Confirmed { get; set; }

    // Draft, Open, Closed or Cancelled.
    public string Status { get; set; } = "Draft";

    public bool SelfSignup { get; set; }

    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }
}
