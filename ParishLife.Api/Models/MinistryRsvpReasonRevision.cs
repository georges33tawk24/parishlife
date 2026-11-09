// Purpose: preserves an attributed encrypted RSVP-reason revision without exposing a general history feed or erasing earlier records.
// Main members: revision and scope identities, actual RecordedBy/RecordedAt, Action, PreviousRevisionId and ProtectedReason.

namespace ParishLife.Api.Models;

public class MinistryRsvpReasonRevision
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string MinistryId { get; set; } = string.Empty;

    public string MeetingId { get; set; } = string.Empty;

    public string PersonId { get; set; } = string.Empty;

    public string AccountId { get; set; } = string.Empty;

    public string RecordedBy { get; set; } = string.Empty;

    public DateTimeOffset RecordedAt { get; set; }

    public string Action { get; set; } = string.Empty;

    public string? PreviousRevisionId { get; set; }

    public string? ProtectedReason { get; set; }
}
