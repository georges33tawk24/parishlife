// Purpose: stores one account-private note or task without plaintext authored content or organizational audience.
// Main members: identity, lifecycle dates, current revision, archive resume state and protected content.

namespace ParishLife.Api.Models;

public class PersonalWorkspaceItem
{
    public string Id { get; set; } = string.Empty;
    public string AccountId { get; set; } = string.Empty;
    public string Kind { get; set; } = "Note";
    public string Status { get; set; } = "Draft";
    public string? StatusBeforeArchive { get; set; }
    public string RevisionId { get; set; } = string.Empty;
    public string ProtectedContent { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public DateTimeOffset? LastCompletedAt { get; set; }
    public DateTimeOffset? ArchivedAt { get; set; }
}
