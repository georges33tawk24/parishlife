// Purpose: one public website section of a parish and which reviewed revision is live.
// Main members: Key, ParishId, PublishedRevisionId, Status, UnpublishReason and UpdatedAt.

namespace ParishLife.Api.Models;

public class WebsiteSection
{
    public string Key { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string? PublishedRevisionId { get; set; }

    // Draft (never published), Published or Unpublished.
    public string Status { get; set; } = "Draft";

    public string? UnpublishReason { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}
