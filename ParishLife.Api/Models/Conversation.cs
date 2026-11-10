// Purpose: represents an inbox conversation: a member with the parish office, or a direct staff conversation with named participants.
// Main members: Id, ParishId, Kind, Subject, ParticipantAccountIds, CreatedBy, CreatedAt and LastMessageAt.

namespace ParishLife.Api.Models;

public class Conversation
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    // Office or Direct.
    public string Kind { get; set; } = "Office";

    public string Subject { get; set; } = string.Empty;

    // Individual participants; Office conversations also include authorized office staff.
    public string[] ParticipantAccountIds { get; set; } = Array.Empty<string>();

    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset LastMessageAt { get; set; }
}
