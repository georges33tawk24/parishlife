// Purpose: returns one in-app notification for its recipient.
// Main members: Id, ParishId, Kind, Topic, Title, Link, Status, CreatedAt and ReadAt.

namespace ParishLife.Api.DTOs.Communications;

public class NotificationDto
{
    public string Id { get; set; } = string.Empty;

    public string? ParishId { get; set; } = null;

    public string Kind { get; set; } = string.Empty;

    public string Topic { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string? Link { get; set; } = null;

    public string Status { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset? ReadAt { get; set; } = null;
}
