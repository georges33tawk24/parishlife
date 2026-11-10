// Purpose: returns a readable pastoral note or task to its author or an explicitly permitted priest.
// Main members: Id, Kind, Title, Body, Category, PersonId, Visibility, SharedWithAccountId, AuthorAccountId, Status, task fields and dates.

namespace ParishLife.Api.DTOs.Care;

public class PastoralNoteDto
{
    public string Id { get; set; } = string.Empty;

    public string Kind { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string Body { get; set; } = string.Empty;

    public string? Category { get; set; } = null;

    public string? PersonId { get; set; } = null;

    public string Visibility { get; set; } = string.Empty;

    public string? SharedWithAccountId { get; set; } = null;

    public string AuthorAccountId { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public string? AssigneeAccountId { get; set; } = null;

    public string? Priority { get; set; } = null;

    public DateTimeOffset? DueAt { get; set; } = null;

    public DateTimeOffset? CompletedAt { get; set; } = null;

    public string? CompletedBy { get; set; } = null;

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}
