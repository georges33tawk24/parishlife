// Purpose: an immutable published platform homepage; the newest Published one is live and earlier ones become Superseded.
// Main members: Id, Status, Content, DraftVersion, PublishedBy, PublishedAt and Reason.

namespace ParishLife.Api.Models;

public class HomepageRevision
{
    public string Id { get; set; } = string.Empty;
    public string Status { get; set; } = "Published";
    public HomepageContent Content { get; set; } = new();
    public string DraftVersion { get; set; } = string.Empty;
    public string PublishedBy { get; set; } = string.Empty;
    public DateTimeOffset PublishedAt { get; set; }
    public string? Reason { get; set; } = null;
}
