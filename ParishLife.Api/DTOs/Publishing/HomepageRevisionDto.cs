// Purpose: one published (or superseded) homepage revision for the operator's history.
// Main members: Id, Status, PublishedBy, PublishedAt, Reason and Content.

namespace ParishLife.Api.DTOs.Publishing;

public class HomepageRevisionDto
{
    public string Id { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string PublishedBy { get; set; } = string.Empty;
    public DateTimeOffset PublishedAt { get; set; }
    public string? Reason { get; set; } = null;
    public HomepageContentDto Content { get; set; } = new();
}
