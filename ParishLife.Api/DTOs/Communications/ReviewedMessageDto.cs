// Purpose: returns the one exact message an approved review covers, to its requester inside the access window only.
// Main members: ReviewId, ConversationId, MessageId, AuthorAccountId, Capacity, Body, At and AccessUntil.

namespace ParishLife.Api.DTOs.Communications;

public class ReviewedMessageDto
{
    public string ReviewId { get; set; } = string.Empty;

    public string ConversationId { get; set; } = string.Empty;

    public string MessageId { get; set; } = string.Empty;

    public string AuthorAccountId { get; set; } = string.Empty;

    public string Capacity { get; set; } = "Self";

    public string Body { get; set; } = string.Empty;

    public DateTimeOffset At { get; set; }

    public DateTimeOffset AccessUntil { get; set; }
}
