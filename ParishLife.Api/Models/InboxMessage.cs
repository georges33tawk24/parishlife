// Purpose: represents one sent inbox message; sent messages are never edited or deleted.
// Main members: Id, ConversationId, AuthorAccountId, Capacity, Body, At and this message's tracked notice pointers.

namespace ParishLife.Api.Models;

public class InboxMessage
{
    public string Id { get; set; } = string.Empty;

    public List<string>? NotificationWorkIds { get; set; } = null;

    public string ConversationId { get; set; } = string.Empty;

    public string AuthorAccountId { get; set; } = string.Empty;

    // Self, or Office when entered by staff for the parish office.
    public string Capacity { get; set; } = "Self";

    public string Body { get; set; } = string.Empty;

    public DateTimeOffset At { get; set; }
}
