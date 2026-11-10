// Purpose: returns a membership request; applicants see their own status and explanation only.
// Main members: Id, ApplicantAccountId, GivenName, FamilyName, BirthDate, Contact, Locality, Note, Status, PersonId, ApplicantReason and dates.

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
}
