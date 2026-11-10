// Purpose: returns one inbox message with its actual author and capacity.
// Main members: Id, AuthorAccountId, Capacity, Body and At.

namespace ParishLife.Api.DTOs.Communications;

public class InboxMessageDto
{
    public string Id { get; set; } = string.Empty;

    public string AuthorAccountId { get; set; } = string.Empty;

    public string Capacity { get; set; } = string.Empty;

    public string Body { get; set; } = string.Empty;

    public DateTimeOffset At { get; set; }
}
