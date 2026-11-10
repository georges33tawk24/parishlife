// Purpose: stores a required in-app notification obligation in the same parish transaction as its source change.
// Main members: immutable recipient/content/source fields, Pending/Stored status and acknowledgment time; no external delivery is implied.

namespace ParishLife.Api.Models;

public class NotificationWork
{
    public string Id { get; set; } = string.Empty;
    public string ParishId { get; set; } = string.Empty;
    public string AccountId { get; set; } = string.Empty;
    public string Topic { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Link { get; set; }
    public string DedupKey { get; set; } = string.Empty;
    public string Audience { get; set; } = string.Empty;
    public string ResourceId { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
    public string Status { get; set; } = "Pending";
    public DateTimeOffset? StoredAt { get; set; }
}
