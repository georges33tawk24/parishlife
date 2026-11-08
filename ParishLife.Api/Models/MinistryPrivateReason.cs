// Purpose: represents ministry private reason business state and rules.
// Main members: Id, ParishId, MinistryId, ApplicationId, ApplicantAccountId, Reason, RecordedAt.

namespace ParishLife.Api.Models;

public class MinistryPrivateReason
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string MinistryId { get; set; } = string.Empty;

    public string ApplicationId { get; set; } = string.Empty;

    public string ApplicantAccountId { get; set; } = string.Empty;

    public string Reason { get; set; } = string.Empty;

    public DateTimeOffset RecordedAt { get; set; }
}
