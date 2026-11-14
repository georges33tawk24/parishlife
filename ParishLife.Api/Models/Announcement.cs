// Purpose: represents a parish announcement with an explicit audience; published announcements are not edited in place.
// Main members: Id, ParishId, Visibility (audience), MinistryId, Title, Body, optional Arabic version (TitleAr, BodyAr), Category, Language,
// Priority, Pinned, ExpiresAt, Status and authoring/publishing facts.

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

    // Optional Arabic version stored with a non-Arabic main text; records saved before it existed return null.
    public string? TitleAr { get; set; } = null;

    public string? BodyAr { get; set; } = null;

    public string? Category { get; set; } = null;

    // en, fr or ar; other translations are separate announcements.
    public string Language { get; set; } = "en";

    // Normal or Urgent; urgent notices are listed first. Nothing is sent outside the app because of it.
    public string Priority { get; set; } = "Normal";

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
