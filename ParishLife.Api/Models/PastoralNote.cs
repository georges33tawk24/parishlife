// Purpose: represents a priest's private pastoral note or task; content is protected at rest and shared only by explicit author choice.
// Main members: Id, ParishId, AccountId (author), Kind, Visibility, SharedWithAccountId, PersonId, ProtectedContent, Category, Status, task fields and dates.

namespace ParishLife.Api.Models;

public class PastoralNote
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    // The author.
    public string AccountId { get; set; } = string.Empty;

    // Note or Task.
    public string Kind { get; set; } = "Note";

    // Author, ParishPriests (current and future priests of this parish) or NamedPriest.
    public string Visibility { get; set; } = "Author";

    public string? SharedWithAccountId { get; set; } = null;

    public string? PersonId { get; set; } = null;

    // Data Protection payload of the title and body.
    public string ProtectedContent { get; set; } = string.Empty;

    public string? Category { get; set; } = null;

    // Notes: Active or Archived. Tasks: Open, Done or Archived.
    public string Status { get; set; } = "Active";

    public string? AssigneeAccountId { get; set; } = null;

    public string? Priority { get; set; } = null;

    public DateTimeOffset? DueAt { get; set; } = null;

    public DateTimeOffset? CompletedAt { get; set; } = null;

    public string? CompletedBy { get; set; } = null;

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}
