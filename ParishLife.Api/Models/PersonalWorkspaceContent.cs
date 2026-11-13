// Purpose: holds authored personal text and optional task details only inside account-bound protected payloads.
// Main members: Title, Body, Category, Tags, Priority, PriorityReason, DueAt, Pinned, ReminderAt and the linked meeting ids;
// content saved before pin/reminder/link existed reads back unpinned, with no reminder and no link.

namespace ParishLife.Api.Models;

public class PersonalWorkspaceContent
{
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
}
