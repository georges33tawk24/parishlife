// Purpose: represents volunteer hours business state and rules.
// Main members: Id, MinistryId, PersonId, EventId, StartsAt, EndsAt, BreakMinutes, and related workflow details.

namespace ParishLife.Api.Models;

public class VolunteerHours
{
    public string Id { get; set; } = string.Empty;

    public string MinistryId { get; set; } = string.Empty;

    public string PersonId { get; set; } = string.Empty;

    public string EventId { get; set; } = string.Empty;

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset EndsAt { get; set; }

    public int BreakMinutes { get; set; }

    public string EvidenceReference { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public string SubmittedBy { get; set; } = string.Empty;

    public string? ReviewedBy { get; set; } = null;
}
