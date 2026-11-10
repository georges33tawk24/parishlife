// Purpose: represents one person's invitation, signup or commitment for one volunteer opportunity.
// Main members: Id, ParishId, MinistryId, OpportunityId, PersonId, slot times, Origin, Status, NextActor, actors, dates and Reason.

namespace ParishLife.Api.Models;

public class VolunteerAssignment
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string MinistryId { get; set; } = string.Empty;

    public string OpportunityId { get; set; } = string.Empty;

    public string PersonId { get; set; } = string.Empty;

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset EndsAt { get; set; }

    // Invitation or Signup.
    public string Origin { get; set; } = "Invitation";

    // Invited, AwaitingConfirmation, Confirmed, Declined, CancellationRequested, Cancelled or Completed.
    public string Status { get; set; } = "Invited";

    // Volunteer, Coordinator or None.
    public string NextActor { get; set; } = "Volunteer";

    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset? RespondedAt { get; set; } = null;

    public string? ConfirmedBy { get; set; } = null;

    public DateTimeOffset? ConfirmedAt { get; set; } = null;

    public DateTimeOffset? CancelledAt { get; set; } = null;

    public DateTimeOffset? CompletedAt { get; set; } = null;

    public string? Reason { get; set; } = null;
}
