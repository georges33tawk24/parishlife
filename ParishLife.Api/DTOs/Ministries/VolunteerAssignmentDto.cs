// Purpose: returns one assignment with its next actor; coordinator projections add the acting identities.
// Main members: Id, OpportunityId, PersonId, StartsAt, EndsAt, Origin, Status, NextActor, dates, Reason, CreatedBy and ConfirmedBy.

namespace ParishLife.Api.DTOs.Ministries;

public class VolunteerAssignmentDto
{
    public string Id { get; set; } = string.Empty;

    public string OpportunityId { get; set; } = string.Empty;

    public string PersonId { get; set; } = string.Empty;

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset EndsAt { get; set; }

    public string Origin { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public string NextActor { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset? RespondedAt { get; set; } = null;

    public DateTimeOffset? ConfirmedAt { get; set; } = null;

    public DateTimeOffset? CancelledAt { get; set; } = null;

    public DateTimeOffset? CompletedAt { get; set; } = null;

    public string? Reason { get; set; } = null;

    public string? CreatedBy { get; set; } = null;

    public string? ConfirmedBy { get; set; } = null;
}
