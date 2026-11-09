// Purpose: retains an immutable account-private snapshot and attribution for each committed personal change.
// Main members: Id, AccountId, ItemId, Action, PreviousRevisionId, PreviousStatus, ActorId, RecordedAt and Snapshot.

namespace ParishLife.Api.Models;

public class PersonalWorkspaceRevision
{
    public string Id { get; set; } = string.Empty;
    public string AccountId { get; set; } = string.Empty;
    public string ItemId { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string? PreviousRevisionId { get; set; }
    public string? PreviousStatus { get; set; }
    public string ActorId { get; set; } = string.Empty;
    public DateTimeOffset RecordedAt { get; set; }
    public PersonalWorkspaceItem Snapshot { get; set; } = new();
}
