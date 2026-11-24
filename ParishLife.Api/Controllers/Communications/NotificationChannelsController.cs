// Purpose: HTTP endpoints for how the signed-in person is reached outside the app (email, push, WhatsApp).
// Main functions: Status, SavePushDevice, RemovePushDevice, StartWhatsApp (rate-limited: it sends a message), ConfirmWhatsApp, RemoveWhatsApp,
// SendTest (a fixed test message to the caller alone; one a minute, five a day per account, plus the per-address sign-in limit).
// The email and channel on/off choices themselves are saved with the notification preferences (PUT api/notifications/preferences).

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ParishLife.Api.DTOs.Communications;
using ParishLife.Api.Services.Communications;

namespace ParishLife.Api.Controllers.Communications;

[ApiController, Authorize]
[Route("api/notifications")]
public class NotificationChannelsController(NotificationChannelService channels) : ControllerBase
{
    [HttpGet("channels")]
    public async Task<ActionResult<NotificationChannelsDto>> Status(CancellationToken ct) => Ok(await channels.StatusAsync(ct));

    // Takes no input: the message, the recipient (the caller) and the link are fixed.
    [HttpPost("test"), EnableRateLimiting("authentication")]
    public async Task<ActionResult<NotificationTestDto>> SendTest([FromServices] NotificationTestService tests, CancellationToken ct)
        => Ok(await tests.SendAsync(ct));

    [HttpPost("push-devices")]
    public async Task<ActionResult<NotificationChannelsDto>> SavePushDevice(SavePushDeviceDto request, CancellationToken ct)
        => Ok(await channels.SavePushDeviceAsync(request, ct));

    [HttpPost("push-devices/remove")]
    public async Task<ActionResult<NotificationChannelsDto>> RemovePushDevice(RemovePushDeviceDto request, CancellationToken ct)
        => Ok(await channels.RemovePushDeviceAsync(request, ct));

    [HttpPost("whatsapp"), EnableRateLimiting("authentication")]
    public async Task<ActionResult<NotificationChannelsDto>> StartWhatsApp(StartWhatsAppDto request, CancellationToken ct)
        => Ok(await channels.StartWhatsAppAsync(request, ct));

    [HttpPost("whatsapp/confirm"), EnableRateLimiting("authentication")]
    public async Task<ActionResult<NotificationChannelsDto>> ConfirmWhatsApp(ConfirmWhatsAppDto request, CancellationToken ct)
        => Ok(await channels.ConfirmWhatsAppAsync(request, ct));

    [HttpPost("whatsapp/remove")]
    public async Task<ActionResult<NotificationChannelsDto>> RemoveWhatsApp(CancellationToken ct) => Ok(await channels.RemoveWhatsAppAsync(ct));
}
