// Purpose: returns one inbox message with its actual author and capacity.
// Main members: Id, AuthorAccountId, Capacity, Body, At and optionally loaded NotificationOutcome.

namespace ParishLife.Api.DTOs.Communications;

public class InboxMessageDto
{
    public string Id { get; set; } = string.Empty;

    public NotificationOutcomeDto? NotificationOutcome { get; set; } = null;

    public string AuthorAccountId { get; set; } = string.Empty;

    public string Capacity { get; set; } = string.Empty;

    public string Body { get; set; } = string.Empty;

    public DateTimeOffset At { get; set; }
}
