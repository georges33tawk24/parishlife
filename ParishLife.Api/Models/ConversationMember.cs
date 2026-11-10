// Purpose: holds one participant's own read and archive state for a conversation.
// Main members: ConversationId, AccountId, LastReadAt and Archived.

namespace ParishLife.Api.Models;

public class ConversationMember
{
    public string ConversationId { get; set; } = string.Empty;

    public string AccountId { get; set; } = string.Empty;

    public DateTimeOffset? LastReadAt { get; set; } = null;

    public bool Archived { get; set; }
}
