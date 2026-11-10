// Purpose: a member's request to close their personal data in one parish, and the office's reviewed outcome.
// Main members: Id, ParishId, AccountId, PersonId, Details, Status, SubmittedAt, Reason, Outcome, DecidedBy and DecidedAt.

namespace ParishLife.Api.Models;

public class DataClosureRequest
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string AccountId { get; set; } = string.Empty;

    public string PersonId { get; set; } = string.Empty;

    public string? Details { get; set; }

    // Submitted, Completed or Declined.
    public string Status { get; set; } = "Submitted";

    public DateTimeOffset SubmittedAt { get; set; }

    public string? Reason { get; set; }

    public string[] Outcome { get; set; } = Array.Empty<string>();

    public string? DecidedBy { get; set; }

    public DateTimeOffset? DecidedAt { get; set; }
}
