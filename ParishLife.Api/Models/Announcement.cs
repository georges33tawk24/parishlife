// Purpose: represents a parish announcement with an explicit audience; published announcements are not edited in place.
// Main members: Id, ParishId, Visibility (audience), MinistryId, Title, Body, Category, Language, Pinned, ExpiresAt, Status and authoring/publishing facts.

namespace ParishLife.Api.Models;

public class Announcement
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    // Public, Members or Ministry.
    public string Visibility { get; set; } = "Members";

    public string? MinistryId { get; set; } = null;

    public string Title { get; set; } = string.Empty;

    public string Body { get; set; } = string.Empty;

    public string? Category { get; set; } = null;

    // en, fr or ar; translations are separate announcements.
    public string Language { get; set; } = "en";

    public bool Pinned { get; set; }

    public DateTimeOffset? ExpiresAt { get; set; } = null;

    // Draft, Published or Withdrawn.
    public string Status { get; set; } = "Draft";

    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public string? PublishedBy { get; set; } = null;

    public DateTimeOffset? PublishedAt { get; set; } = null;

    public string? WithdrawalReason { get; set; } = null;
}
