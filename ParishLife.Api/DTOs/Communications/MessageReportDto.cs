// Purpose: shows a message report to its reporter, or to a restricted platform reviewer with the reporter's account.
// Main members: Id, ConversationId, MessageId, Explanation, Status, ReporterOutcome, ReporterAccountId (reviewers only) and dates.

namespace ParishLife.Api.DTOs.Communications;

public class MessageReportDto
{
    public string Id { get; set; } = string.Empty;

    public string ConversationId { get; set; } = string.Empty;

    public string MessageId { get; set; } = string.Empty;

    public string Explanation { get; set; } = string.Empty;

    public string Status { get; set; } = "Received";

    public string? ReporterOutcome { get; set; } = null;

    // Reviewer projection only; null in the reporter's own view.
    public string? ReporterAccountId { get; set; } = null;

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset? ClosedAt { get; set; } = null;
}
