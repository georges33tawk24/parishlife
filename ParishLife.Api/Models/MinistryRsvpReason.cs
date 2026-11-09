// Purpose: stores the current encrypted private planning reason and immutable original-author binding separately from public RSVP records.
// Main members: parish/ministry/meeting/person/account identity, ProtectedReason, Cleared, RecordedAt and RevisionId.

namespace ParishLife.Api.Models;

public class MinistryRsvpReason
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string MinistryId { get; set; } = string.Empty;

    public string MeetingId { get; set; } = string.Empty;

    public string PersonId { get; set; } = string.Empty;

    public string AccountId { get; set; } = string.Empty;

    public string? ProtectedReason { get; set; }

    public bool Cleared { get; set; }

    public DateTimeOffset RecordedAt { get; set; }

    public string RevisionId { get; set; } = string.Empty;
}
