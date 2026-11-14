// Purpose: returns a conversation with the caller's own unread and archive state.
// Main members: Id, Kind, Subject, ParticipantAccountIds, CreatedBy, LastMessageAt, Unread, Archived and optionally loaded NotificationOutcome.

namespace ParishLife.Api.DTOs.Communications;

public class ConversationDto
{
    public string Id { get; set; } = string.Empty;

    public NotificationOutcomeDto? NotificationOutcome { get; set; } = null;

    public string Kind { get; set; } = string.Empty;

    public string Subject { get; set; } = string.Empty;

    public string[] ParticipantAccountIds { get; set; } = Array.Empty<string>();

    // The account that started the conversation: a member writing to the office, or the staff member who wrote directly.
    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset LastMessageAt { get; set; }

    public bool Unread { get; set; }

    public bool Archived { get; set; }
}
