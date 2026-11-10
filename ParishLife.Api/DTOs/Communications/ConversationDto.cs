// Purpose: returns a conversation with the caller's own unread and archive state.
// Main members: Id, Kind, Subject, ParticipantAccountIds, LastMessageAt, Unread and Archived.

namespace ParishLife.Api.DTOs.Communications;

public class ConversationDto
{
    public string Id { get; set; } = string.Empty;

    public string Kind { get; set; } = string.Empty;

    public string Subject { get; set; } = string.Empty;

    public string[] ParticipantAccountIds { get; set; } = Array.Empty<string>();

    public DateTimeOffset LastMessageAt { get; set; }

    public bool Unread { get; set; }

    public bool Archived { get; set; }
}
