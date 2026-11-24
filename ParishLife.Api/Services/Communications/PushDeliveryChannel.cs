// Purpose: the push channel for notices and broadcasts: one Web Push message to each device the person allowed, if they keep push on.
// Main members: Name ("Push"), Configured, SendAsync (Sent if any device accepted; a device the push service reports gone is removed from
// the account). The payload is the title, a short body and the sign-in link; the service worker shows it and opens the link when tapped.

using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Communications;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Communications;

public class PushDeliveryChannel(WebPushSender sender, IRecordTransactions records, TimeProvider clock) : IDeliveryChannel
{
    public string Name => "Push";

    public bool Configured => sender.Configured;

    public async Task<DeliveryOutcome> SendAsync(DeliveryTarget target, DeliveryMessage message, CancellationToken ct)
    {
        if (!Configured || !target.Preferences.Push || target.Devices.Count == 0)
            return DeliveryOutcome.Skipped;
        var body = message.Body is { Length: > 180 } text ? text[..177] + "…" : message.Body;
        var payload = new { title = message.Title.Length > 120 ? message.Title[..117] + "…" : message.Title, body, url = message.Link };
        var sent = false;
        var failed = false;
        foreach (var device in target.Devices)
        {
            switch (await sender.SendAsync(device.Value, payload, ct))
            {
                case PushSendResult.Sent:
                    sent = true;
                    break;
                case PushSendResult.Gone:
                    await RemoveAsync(target.AccountId, device, ct);
                    break;
                default:
                    failed = true;
                    break;
            }
        }
        return sent ? DeliveryOutcome.Sent : failed ? DeliveryOutcome.Failed : DeliveryOutcome.Skipped;
    }

    private async Task RemoveAsync(string account, Versioned<PushDevice> device, CancellationToken ct)
    {
        try
        {
            await records.CommitAsync(new RecordScope { Area = RecordArea.Account, OwnerId = account },
                Operation.Create(Guid.NewGuid(), "system:delivery", new { Kind = "push.device.gone", device.Value.Id }, clock),
                "notification.push_device_gone", device.Value.Id, [RecordChange.Remove("pushDevice:" + device.Value.Id, device.Version)],
                new CommandResult { Id = device.Value.Id, Status = "Removed" }, ct);
        }
        catch (DomainException) { /* already removed or changed meanwhile; the next delivery reads the current devices */ }
    }
}
