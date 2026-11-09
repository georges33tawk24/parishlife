// Purpose: returns a confidential RSVP reason only to its original author or an explicitly designated current reader.
// Main members: MeetingId, PersonId, Reason, Cleared, RecordedAt and CanEdit; account identifiers and protected persistence fields are excluded.

namespace ParishLife.Api.DTOs.Ministries;

public class PrivateRsvpReasonDto
{
    public string MeetingId { get; set; } = string.Empty;

    public string PersonId { get; set; } = string.Empty;

    public string? Reason { get; set; }

    public bool Cleared { get; set; }

    public DateTimeOffset RecordedAt { get; set; }

    public bool CanEdit { get; set; }
}
