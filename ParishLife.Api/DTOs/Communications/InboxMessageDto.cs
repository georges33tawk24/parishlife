// Purpose: returns one inbox message with its actual author and capacity.
// Main members: Id, AuthorAccountId, Capacity, Body, At, VoiceSeconds/VoiceType (a voice note), Delivered/Read (the caller's own messages only:
// the other side's inbox showed it / opened it, as the ticks in a chat app) and optionally loaded NotificationOutcome.

namespace ParishLife.Api.DTOs.Communications;

public class InboxMessageDto
{
    public string Id { get; set; } = string.Empty;

    public NotificationOutcomeDto? NotificationOutcome { get; set; } = null;

    public string AuthorAccountId { get; set; } = string.Empty;

    public string Capacity { get; set; } = string.Empty;

    public string Body { get; set; } = string.Empty;

    public DateTimeOffset At { get; set; }

    public int? VoiceSeconds { get; set; } = null;

    public string? VoiceType { get; set; } = null;

    public bool? Delivered { get; set; } = null;

    public bool? Read { get; set; } = null;
}
