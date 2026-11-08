// Purpose: represents meeting rsvp business state and rules.
// Main members: Id, MeetingId, PersonId, Response, RespondedAt.

namespace ParishLife.Api.Models;

public class MeetingRsvp
{
    public string Id { get; set; } = string.Empty;

    public string MeetingId { get; set; } = string.Empty;

    public string PersonId { get; set; } = string.Empty;

    public string Response { get; set; } = string.Empty;

    public DateTimeOffset RespondedAt { get; set; }
}
