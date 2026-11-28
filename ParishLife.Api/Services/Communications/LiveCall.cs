// Purpose: one voice or video call that is ringing or in progress, kept in memory only (nothing about a call is stored except the
// "missed call" message an unanswered call leaves in its conversation).
// Main members: Id, ParishId, ConversationId, CallerAccountId, CalleeAccountId, Video, Answered and StartedAt.

namespace ParishLife.Api.Services.Communications;

public class LiveCall
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string ConversationId { get; set; } = string.Empty;

    public string CallerAccountId { get; set; } = string.Empty;

    public string CalleeAccountId { get; set; } = string.Empty;

    public bool Video { get; set; }

    public bool Answered { get; set; }

    public DateTimeOffset StartedAt { get; set; }
}
