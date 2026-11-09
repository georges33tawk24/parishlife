// Purpose: stores an encrypted confidential departure reason in the existing parish transaction partition.
// Main members: Id, ParishId, MinistryId, ApplicationId, ApplicantAccountId, ProtectedReason, RecordedAt.

namespace ParishLife.Api.Models;

public class MinistryPrivateReason
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string MinistryId { get; set; } = string.Empty;

    public string ApplicationId { get; set; } = string.Empty;

    public string ApplicantAccountId { get; set; } = string.Empty;

    public string ProtectedReason { get; set; } = string.Empty;

    public DateTimeOffset RecordedAt { get; set; }
}
