// Purpose: one revision of a website section moving Draft -> AwaitingReview -> Published (or Returned), then Superseded by a later one.
// Main members: Id, ParishId, SectionKey, Texts, Status, CreatedBy, CreatedAt, ReviewedBy, ReviewedAt, ReturnReason and PublishedAt.

namespace ParishLife.Api.Models;

public class WebsiteRevision
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string SectionKey { get; set; } = string.Empty;

    public Dictionary<string, WebsiteText> Texts { get; set; } = new();

    public string Status { get; set; } = "Draft";

    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public string? ReviewedBy { get; set; }

    public DateTimeOffset? ReviewedAt { get; set; }

    public string? ReturnReason { get; set; }

    public DateTimeOffset? PublishedAt { get; set; }
}
