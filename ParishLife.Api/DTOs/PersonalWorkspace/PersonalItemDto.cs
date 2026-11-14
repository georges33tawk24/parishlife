// Purpose: returns the authenticated author's personal content with its explicit audience and actual lifecycle dates.
// Main members: identity, audience, original text/tags/task details, pin, private reminder date, linked meeting ids,
// revision and creation/update/completion/archive times.

namespace ParishLife.Api.DTOs.PersonalWorkspace;

public class PersonalItemDto
{
    public string Id { get; set; } = string.Empty;
    public string OwnerAccountId { get; set; } = string.Empty;
    public string Audience { get; set; } = "Only you";
    public string Kind { get; set; } = "Note";
    public string Status { get; set; } = "Draft";
    public string RevisionId { get; set; } = string.Empty;
    public string? Title { get; set; }
    public string Body { get; set; } = string.Empty;
    public string? Category { get; set; }
    public string[] Tags { get; set; } = Array.Empty<string>();
    public string? Priority { get; set; }
    public string? PriorityReason { get; set; }
    public DateTimeOffset? DueAt { get; set; }
    public bool Pinned { get; set; }
    public DateTimeOffset? ReminderAt { get; set; }
    public string? MeetingParishId { get; set; }
    public string? MeetingMinistryId { get; set; }
    public string? MeetingId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public DateTimeOffset? LastCompletedAt { get; set; }
    public DateTimeOffset? ArchivedAt { get; set; }
}
