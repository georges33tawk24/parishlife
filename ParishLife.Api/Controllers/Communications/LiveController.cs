// Purpose: the signed-in account's live channel (server-sent events) and its calls over HTTP.
// Main functions: Live (GET api/me/live streams LiveHub events, with a keep-alive comment every 25 seconds), CallSettings, Place, Answer, End.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Communications;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Communications;

namespace ParishLife.Api.Controllers.Communications;

[Authorize, ApiController]
public class LiveController(LiveHub hub, CallService calls, ICurrentActor actor) : ControllerBase
{
    [HttpGet("api/me/live")]
    public async Task Live(CancellationToken ct)
    {
        Response.ContentType = "text/event-stream";
        Response.Headers["X-Accel-Buffering"] = "no";
        var account = actor.AccountId;
        var (id, reader) = hub.Subscribe(account);
        try
        {
            await Response.WriteAsync(": open\n\n", ct);
            await Response.Body.FlushAsync(ct);
            while (!ct.IsCancellationRequested)
            {
                using var wait = CancellationTokenSource.CreateLinkedTokenSource(ct);
                wait.CancelAfter(TimeSpan.FromSeconds(25)); // under App Service's idle limit
                try
                {
                    var data = await reader.ReadAsync(wait.Token);
                    await Response.WriteAsync("data: " + data + "\n\n", ct);
                }
                catch (OperationCanceledException) when (!ct.IsCancellationRequested)
                {
                    await Response.WriteAsync(": keep-alive\n\n", ct);
                }
                await Response.Body.FlushAsync(ct);
            }
        }
        catch (OperationCanceledException) { }
        catch (System.Threading.Channels.ChannelClosedException) { }
        finally
        {
            hub.Unsubscribe(account, id);
        }
    }

    [HttpGet("api/calls/settings")]
    public ActionResult<CallSettingsDto> CallSettings() => Ok(calls.Settings());

    [HttpPost("api/parishes/{parishId:guid}/inbox/{conversationId:guid}/calls")]
    public async Task<ActionResult<CallDto>> Place(Guid parishId, Guid conversationId, PlaceCallDto request, CancellationToken ct)
        => Ok(await calls.PlaceAsync(Guard.Id(parishId), Guard.Id(conversationId), request, ct));

    [HttpPost("api/calls/{callId:guid}/answer")]
    public IActionResult Answer(Guid callId, AnswerCallDto request)
    {
        calls.Answer(Guard.Id(callId), request);
        return NoContent();
    }

    [HttpPost("api/calls/{callId:guid}/end")]
    public async Task<IActionResult> End(Guid callId, EndCallDto request, CancellationToken ct)
    {
        await calls.EndAsync(Guard.Id(callId), request, ct);
        return NoContent();
    }
}
