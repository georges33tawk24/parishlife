// Purpose: returns one owner-only historic content snapshot with the actual committed action and actor.
// Main members: Id, Action, PreviousRevisionId, PreviousStatus, ActorId, RecordedAt and Snapshot.

namespace ParishLife.Api.DTOs.PersonalWorkspace;

public class PersonalItemRevisionDto
{
    public string Id { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string? PreviousRevisionId { get; set; }
    public string? PreviousStatus { get; set; }
    public string ActorId { get; set; } = string.Empty;
    public DateTimeOffset RecordedAt { get; set; }
    public PersonalItemDto Snapshot { get; set; } = new();
}
