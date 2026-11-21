// Purpose: reaches one account outside the app through every configured channel the person chose.
// Main functions: TargetAsync (fresh read of the account: a confirmed email only, a verified WhatsApp number only, allowed push devices, the
// channel choices; null for an inactive or unknown account), DeliverAsync (each configured channel not yet done, with its outcome), Channels.

using Microsoft.AspNetCore.Identity;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Communications;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Communications;

public class DeliveryService(IEnumerable<IDeliveryChannel> channels, IRecordTransactions records, IUserStore<ParishUser> users)
{
    public const string WhatsAppKey = "whatsappContact";

    public IReadOnlyList<IDeliveryChannel> Channels { get; } = channels.Where(channel => channel.Configured).ToList();

    public async Task<DeliveryTarget?> TargetAsync(string accountId, CancellationToken ct)
    {
        var account = await users.FindByIdAsync(accountId, ct);
        if (account is not { Active: true })
            return null;
        var scope = new RecordScope { Area = RecordArea.Account, OwnerId = accountId };
        var preferences = (await records.ReadAsync<NotificationPreferences>(scope, "notificationPreferences", ct))?.Value ?? new NotificationPreferences();
        var whatsApp = (await records.ReadAsync<WhatsAppContact>(scope, WhatsAppKey, ct))?.Value;
        return new DeliveryTarget
        {
            AccountId = accountId,
            Email = account.EmailConfirmed ? account.Email : null,
            Phone = whatsApp is { Status: "Verified" } ? whatsApp.Phone : null,
            Devices = [.. await records.CollectAsync<PushDevice>(scope, "pushDevice", ct, 20)],
            Preferences = preferences
        };
    }

    public async Task<Dictionary<string, DeliveryOutcome>> DeliverAsync(DeliveryTarget target, DeliveryMessage message, IReadOnlyCollection<string> done, CancellationToken ct)
    {
        var outcomes = new Dictionary<string, DeliveryOutcome>(StringComparer.Ordinal);
        foreach (var channel in Channels.Where(channel => !done.Contains(channel.Name)))
            outcomes[channel.Name] = await channel.SendAsync(target, message, ct);
        return outcomes;
    }
}
