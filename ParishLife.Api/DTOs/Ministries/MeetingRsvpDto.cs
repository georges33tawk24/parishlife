// Purpose: distinguishes a stored planning reply from no reply without implying attendance or exposing account credentials.
// Main members: MeetingId, PersonId, Recorded, nullable Response/RespondedAt and current CanChange state.

namespace ParishLife.Api.DTOs.Ministries;

public class MeetingRsvpDto
{
    public string MeetingId { get; set; } = string.Empty;
    public string PersonId { get; set; } = string.Empty;
    public bool Recorded { get; set; }
    public string? Response { get; set; }
    public DateTimeOffset? RespondedAt { get; set; }
    public bool CanChange { get; set; }
}
