// Purpose: exposes the caller's in-app notifications and preferences, and parish inbox conversations, over HTTP.
// Main functions: Notifications, SetNotificationState, Preferences, SavePreferences, Start, Conversations, Messages, Post and Archive.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Communications;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Communications;

namespace ParishLife.Api.Controllers.Communications;

[Authorize, ApiController]
public class InboxController(NotificationService notifications, InboxService inbox) : ControllerBase
{
    [HttpGet("api/notifications")]
    public async Task<ActionResult<Page<NotificationDto>>> Notifications(CancellationToken ct, string? status = null, int size = 25, string? cursor = null)
        => Ok(await notifications.ListAsync(status, size, cursor, ct));

    [HttpPost("api/notifications/{notificationId:guid}/state")]
    public async Task<ActionResult<NotificationDto>> SetNotificationState(Guid notificationId, NotificationStateDto request, CancellationToken ct)
        => Ok(await notifications.SetStateAsync(Guard.Id(notificationId), request, ct));

    [HttpGet("api/notifications/preferences")]
    public async Task<ActionResult<NotificationPreferencesDto>> Preferences(CancellationToken ct)
        => Ok(await notifications.PreferencesAsync(ct));

    [HttpPut("api/notifications/preferences")]
    public async Task<ActionResult<NotificationPreferencesDto>> SavePreferences(NotificationPreferencesDto request, CancellationToken ct)
        => Ok(await notifications.SavePreferencesAsync(request, ct));

    [HttpPost("api/parishes/{parishId:guid}/inbox")]
    public async Task<ActionResult<ConversationDto>> Start(Guid parishId, StartConversationDto request, CancellationToken ct)
        => Ok(await inbox.StartAsync(Guard.Id(parishId), request, ct));

    [HttpGet("api/parishes/{parishId:guid}/inbox")]
    public async Task<ActionResult<IReadOnlyList<ConversationDto>>> Conversations(Guid parishId, CancellationToken ct)
        => Ok(await inbox.ListAsync(Guard.Id(parishId), ct));

    [HttpGet("api/parishes/{parishId:guid}/inbox/{conversationId:guid}")]
    public async Task<ActionResult<IReadOnlyList<InboxMessageDto>>> Messages(Guid parishId, Guid conversationId, CancellationToken ct)
        => Ok(await inbox.MessagesAsync(Guard.Id(parishId), Guard.Id(conversationId), ct));

    [HttpPost("api/parishes/{parishId:guid}/inbox/{conversationId:guid}/messages")]
    public async Task<ActionResult<InboxMessageDto>> Post(Guid parishId, Guid conversationId, PostInboxMessageDto request, CancellationToken ct)
        => Ok(await inbox.PostAsync(Guard.Id(parishId), Guard.Id(conversationId), request, ct));

    [HttpPost("api/parishes/{parishId:guid}/inbox/{conversationId:guid}/archive")]
    public async Task<ActionResult<ConversationDto>> Archive(Guid parishId, Guid conversationId, CancellationToken ct, bool archived = true)
        => Ok(await inbox.ArchiveAsync(Guard.Id(parishId), Guard.Id(conversationId), archived, ct));
}
