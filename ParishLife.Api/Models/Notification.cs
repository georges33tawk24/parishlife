// Purpose: represents one in-app notification stored for its recipient; it implies no external delivery or reading.
// Main members: Id, AccountId, ParishId, Kind, Topic, Title, Link, Status, CreatedAt and ReadAt.

namespace ParishLife.Api.Models;

public class Notification
{
    // Derived from the producer's deduplication key, so a retried event is stored once.
    public string Id { get; set; } = string.Empty;

    public string AccountId { get; set; } = string.Empty;

    public string? ParishId { get; set; } = null;

    // Required (own case/security) or Optional (community updates).
    public string Kind { get; set; } = "Required";

    public string Topic { get; set; } = string.Empty;

    // Neutral text without sensitive category, subject or accusation.
    public string Title { get; set; } = string.Empty;

    public string? Link { get; set; } = null;

    // Unread, Read or Archived.
    public string Status { get; set; } = "Unread";

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset? ReadAt { get; set; } = null;
}
