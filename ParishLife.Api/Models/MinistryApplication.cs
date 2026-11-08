// Purpose: represents ministry application business state and rules.
// Main members: Id, MinistryId, PersonId, ApplicantAccountId, Kind, Status, SubmittedBy, and related workflow details.

namespace ParishLife.Api.Models;

public class MinistryApplication
{
    public string Id { get; set; } = string.Empty;

    public string MinistryId { get; set; } = string.Empty;

    public string PersonId { get; set; } = string.Empty;

    public string? ApplicantAccountId { get; set; }

    public string Kind { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public string SubmittedBy { get; set; } = string.Empty;

    public DateTimeOffset SubmittedAt { get; set; }

    public string? ReviewedBy { get; set; } = null;

    public string? DecidedBy { get; set; } = null;

    public DateTimeOffset? DecidedAt { get; set; } = null;

    public string? PriorStatus { get; set; } = null;
}
