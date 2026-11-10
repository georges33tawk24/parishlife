// Purpose: one exceptional, justified, independently approved and time-limited review of a single exact inbox message.
// Main members: Id, ParishId, ConversationId, MessageId, ReportId, Reason, requester/approver/closer facts, Status, AccessUntil and ReadCount.

namespace ParishLife.Api.Models;

public class MessageReview
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string ConversationId { get; set; } = string.Empty;

    public string MessageId { get; set; } = string.Empty;

    public string? ReportId { get; set; } = null;

    public string Reason { get; set; } = string.Empty;

    public string RequestedBy { get; set; } = string.Empty;

    public DateTimeOffset RequestedAt { get; set; }

    // Requested, Approved, Declined or Closed; an Approved review past AccessUntil is reported as Expired.
    public string Status { get; set; } = "Requested";

    public string? DecidedBy { get; set; } = null;

    public DateTimeOffset? DecidedAt { get; set; } = null;

    public string? DecisionReason { get; set; } = null;

    public DateTimeOffset? AccessUntil { get; set; } = null;

    public string? ClosedBy { get; set; } = null;

    public DateTimeOffset? ClosedAt { get; set; } = null;

    public string? ClosingNote { get; set; } = null;

    public int ReadCount { get; set; }
}
