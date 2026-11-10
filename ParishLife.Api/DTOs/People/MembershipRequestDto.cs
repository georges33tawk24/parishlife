// Purpose: returns a membership request; applicants see their own status and explanation only.
// Main members: Id, applicant-visible facts, office-only links, decision dates and a separately loaded safe NotificationOutcome.

using ParishLife.Api.DTOs.Communications;

namespace ParishLife.Api.DTOs.People;

public class MembershipRequestDto
{
    public string Id { get; set; } = string.Empty;

    public string? ApplicantAccountId { get; set; } = null;

    public string GivenName { get; set; } = string.Empty;

    public string FamilyName { get; set; } = string.Empty;

    public DateOnly? BirthDate { get; set; } = null;

    public string? Contact { get; set; } = null;

    public string? Locality { get; set; } = null;

    public string? Note { get; set; } = null;

    public string Status { get; set; } = string.Empty;

    public string? PersonId { get; set; } = null;

    public string? ApplicantReason { get; set; } = null;

    public DateTimeOffset SubmittedAt { get; set; }

    public DateTimeOffset? DecidedAt { get; set; } = null;

    // Null in list projections means the outcome was not loaded, not that delivery succeeded.
    public NotificationOutcomeDto? NotificationOutcome { get; set; } = null;
}
