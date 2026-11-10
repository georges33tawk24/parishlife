// Purpose: shows a website section to editors: its live state, live revision and any revision still being worked on.
// Main members: Key, Status, UnpublishReason, Published and Pending.

namespace ParishLife.Api.DTOs.Publishing;

public class WebsiteSectionDto
{
    public string Key { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public string? UnpublishReason { get; set; }

    public WebsiteRevisionDto? Published { get; set; }

    public WebsiteRevisionDto? Pending { get; set; }
}
