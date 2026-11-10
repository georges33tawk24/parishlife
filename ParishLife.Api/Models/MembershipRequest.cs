// Purpose: represents an account's request for office-reviewed parish membership and a verified person link.
// Main members: Id, ParishId, ApplicantAccountId, supplied identity facts, Note, Status, PersonId, ApplicantReason, decision facts and dates.

namespace ParishLife.Api.Models;

public class MembershipRequest
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string ApplicantAccountId { get; set; } = string.Empty;

    public string GivenName { get; set; } = string.Empty;

    public string FamilyName { get; set; } = string.Empty;

    public DateOnly? BirthDate { get; set; } = null;

    public string? Contact { get; set; } = null;

    public string? Locality { get; set; } = null;

    public string? Note { get; set; } = null;

    // Submitted, NeedsInformation, Linked, Declined or Withdrawn.
    public string Status { get; set; } = "Submitted";

    public string? PersonId { get; set; } = null;

    // Applicant-visible explanation; internal evidence stays separate.
    public string? ApplicantReason { get; set; } = null;

    public string? DecidedBy { get; set; } = null;

    public DateTimeOffset? DecidedAt { get; set; } = null;

    public DateTimeOffset SubmittedAt { get; set; }
}
