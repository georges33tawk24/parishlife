// Purpose: shows an exact-message review's request, decision, access window and closure to platform reviewers; never message content.
// Main members: Id, ConversationId, MessageId, ReportId, Reason, Status, requester/decision/closure facts, AccessUntil and ReadCount.

namespace ParishLife.Api.DTOs.Communications;

public class MessageReviewDto
{
    public string Id { get; set; } = string.Empty;

    public string ConversationId { get; set; } = string.Empty;

    public string MessageId { get; set; } = string.Empty;

    public string? ReportId { get; set; } = null;

    public string Reason { get; set; } = string.Empty;

    public string Status { get; set; } = "Requested";

    public string RequestedBy { get; set; } = string.Empty;

    public DateTimeOffset RequestedAt { get; set; }

    public string? DecidedBy { get; set; } = null;

    public DateTimeOffset? DecidedAt { get; set; } = null;

    public string? DecisionReason { get; set; } = null;

    public DateTimeOffset? AccessUntil { get; set; } = null;

    public string? ClosedBy { get; set; } = null;

    public DateTimeOffset? ClosedAt { get; set; } = null;

    public string? ClosingNote { get; set; } = null;

    public int ReadCount { get; set; }
}
