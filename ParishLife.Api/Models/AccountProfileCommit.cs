// Purpose: retains a minimal idempotent profile-operation outcome without copying personal display or preference values into receipts.
// Main members: CommitId distinguishes a concurrent retry; AppliedAt records when the original change was committed.

namespace ParishLife.Api.Models;

public class AccountProfileCommit
{
    public string CommitId { get; set; } = string.Empty;

    public DateTimeOffset AppliedAt { get; set; }
}
