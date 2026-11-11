// Purpose: a participant's report of one exact inbox message (unwanted contact or inappropriate content), kept for restricted review.
// Main members: Id, ParishId, ConversationId, MessageId, ReporterAccountId, ProtectedExplanation, Status, ReporterOutcome and dates.

namespace ParishLife.Api.Models;

public class MessageReport
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string ConversationId { get; set; } = string.Empty;

    public string MessageId { get; set; } = string.Empty;

    public string ReporterAccountId { get; set; } = string.Empty;

    // The complainant's explanation, protected at rest for the restricted reviewer audience.
    public string ProtectedExplanation { get; set; } = string.Empty;

    // Received or Closed.
    public string Status { get; set; } = "Received";

    // The neutral outcome the reviewer chose to tell the reporter; never another party's evidence or account details.
    public string? ReporterOutcome { get; set; } = null;

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset? ClosedAt { get; set; } = null;
}
