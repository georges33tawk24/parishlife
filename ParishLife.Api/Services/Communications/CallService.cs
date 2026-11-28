// Purpose: voice and video calls between the two people of a conversation, peer to peer (WebRTC). The API only passes the offer and the
// answer between the two portals (LiveHub) and never carries the audio or video; nothing about a call is stored except a "missed call"
// message when a call goes unanswered.
// Main functions: Settings (STUN/TURN servers from Calls:IceServers), PlaceAsync (rings the other person's open portal), AnswerAsync, EndAsync.
// A call is with one person: a direct chat, or staff calling the member of an office conversation; a member cannot ring "the parish office".

using ParishLife.Api.DTOs.Communications;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Communications;

public class CallService(InboxService inbox, LiveHub live, ICurrentActor actor, TimeProvider clock, IConfiguration configuration)
{
    private static readonly TimeSpan RingFor = TimeSpan.FromSeconds(60), LastsAtMost = TimeSpan.FromHours(4);
    private static DomainException Missing() => new("resource_not_found", "The requested call is unavailable.", FailureKind.NotFound);

    public CallSettingsDto Settings() => new()
    {
        IceServers = (configuration.GetSection("Calls:IceServers").Get<string[]>() ?? [])
            .Where(url => url.StartsWith("stun:", StringComparison.Ordinal) || url.StartsWith("turn:", StringComparison.Ordinal) || url.StartsWith("turns:", StringComparison.Ordinal))
            .ToArray()
    };

    public async Task<CallDto> PlaceAsync(string parish, string conversation, PlaceCallDto request, CancellationToken ct)
    {
        var item = await inbox.AccessibleAsync(parish, conversation, ct);
        var others = item.ParticipantAccountIds.Where(p => p != actor.AccountId).Distinct(StringComparer.Ordinal).ToArray();
        var participant = item.ParticipantAccountIds.Contains(actor.AccountId, StringComparer.Ordinal);
        if (item.Kind == "Office" && participant || others.Length != 1)
            throw new DomainException("invalid_input", "A call is with one person. Write to the parish office instead.");
        var callee = others[0];
        var now = clock.GetUtcNow();
        // Forget calls whose tabs went away without ending them.
        foreach (var old in live.Calls.Values.Where(c => !c.Answered && now - c.StartedAt > RingFor || now - c.StartedAt > LastsAtMost))
            live.Calls.TryRemove(old.Id, out _);
        if (live.Calls.Values.Any(c => c.CallerAccountId == callee || c.CalleeAccountId == callee))
            throw new DomainException("call_busy", "This person is already on a call.", FailureKind.Conflict);
        if (!live.Online(callee))
        {
            await MissedAsync(parish, conversation, request.Video, ct);
            return new CallDto { Ringing = false };
        }
        var call = new LiveCall
        {
            Id = Guid.NewGuid().ToString("N"), ParishId = parish, ConversationId = conversation, CallerAccountId = actor.AccountId,
            CalleeAccountId = callee, Video = request.Video, StartedAt = now
        };
        live.Calls[call.Id] = call;
        live.Publish(callee, new { type = "call", callId = call.Id, parishId = parish, conversationId = conversation, from = actor.AccountId, video = call.Video, sdp = request.Sdp });
        return new CallDto { Id = call.Id, Ringing = true };
    }

    public void Answer(string id, AnswerCallDto request)
    {
        if (!live.Calls.TryGetValue(id, out var call) || call.CalleeAccountId != actor.AccountId || call.Answered)
            throw Missing();
        call.Answered = true;
        live.Publish(call.CallerAccountId, new { type = "call-answer", callId = id, sdp = request.Sdp });
        live.Publish(call.CalleeAccountId, new { type = "call-taken", callId = id }); // the callee's other tabs stop ringing
    }

    public async Task EndAsync(string id, EndCallDto request, CancellationToken ct)
    {
        if (!live.Calls.TryGetValue(id, out var call) || call.CallerAccountId != actor.AccountId && call.CalleeAccountId != actor.AccountId)
            throw Missing();
        if (!live.Calls.TryRemove(id, out _)) return;
        foreach (var account in new[] { call.CallerAccountId, call.CalleeAccountId })
            live.Publish(account, new { type = "call-end", callId = id, reason = request.Reason });
        if (!call.Answered && call.CallerAccountId == actor.AccountId && request.Reason is "Cancelled" or "NoAnswer")
            await MissedAsync(call.ParishId, call.ConversationId, call.Video, ct);
    }

    // The unanswered call stays in the chat, from the caller, like any message (with its notice).
    private Task MissedAsync(string parish, string conversation, bool video, CancellationToken ct)
        => inbox.PostAsync(parish, conversation, new PostInboxMessageDto { OperationId = Guid.NewGuid(), Body = video ? "Missed video call" : "Missed voice call" }, ct);
}
