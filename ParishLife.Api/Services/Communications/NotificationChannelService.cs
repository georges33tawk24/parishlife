// Purpose: lets the signed-in person set up how they are reached outside the app: register or remove push devices, and prove a WhatsApp
// number with a one-use code sent to it (proving it also turns WhatsApp notices on; removing it turns them off).
// Main functions: StatusAsync, SavePushDeviceAsync (known push services only, at most 10 devices), RemovePushDeviceAsync, StartWhatsAppAsync
// (six-digit code, 15 minutes, one per minute), ConfirmWhatsAppAsync (five attempts) and RemoveWhatsAppAsync. Codes are stored only as a
// hash and never enter receipts, audit or logs. Recovery sign-ins cannot reach these routes (the default restriction).

using System.Buffers.Text;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using ParishLife.Api.Configuration;
using ParishLife.Api.DTOs.Communications;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Communications;

public class NotificationChannelService(IRecordTransactions records, ICurrentActor actor, IUserStore<ParishUser> users, DeliveryQueue queue,
    IOptions<WebPushOptions> push, WhatsAppSender whatsApp, TimeProvider clock)
{
    internal const int MaximumDevices = 10;
    internal const int MaximumAttempts = 5;
    private static readonly TimeSpan CodeLifetime = TimeSpan.FromMinutes(15);
    private static readonly TimeSpan ResendInterval = TimeSpan.FromMinutes(1);
    private const string PreferencesKey = "notificationPreferences";
    private RecordScope Scope => new() { Area = RecordArea.Account, OwnerId = actor.AccountId };

    public async Task<NotificationChannelsDto> StatusAsync(CancellationToken ct)
    {
        var account = await users.FindByIdAsync(actor.AccountId, ct);
        var contact = (await records.ReadAsync<WhatsAppContact>(Scope, DeliveryService.WhatsAppKey, ct))?.Value;
        return new NotificationChannelsDto
        {
            Email = queue.Configured("Email"), EmailAddressConfirmed = account?.EmailConfirmed == true,
            Push = queue.Configured("Push"), PushPublicKey = queue.Configured("Push") ? push.Value.PublicKey : null,
            PushDevices = (await records.CollectAsync<PushDevice>(Scope, "pushDevice", ct, MaximumDevices + 5)).Count,
            WhatsApp = queue.Configured("WhatsApp"), WhatsAppPhone = contact?.Phone, WhatsAppStatus = contact?.Status ?? "None"
        };
    }

    public async Task<NotificationChannelsDto> SavePushDeviceAsync(SavePushDeviceDto request, CancellationToken ct)
    {
        if (!queue.Configured("Push"))
            throw new DomainException("push_unavailable", "Push notifications are not set up on this site yet.", FailureKind.Unavailable);
        if (!WebPushSender.AllowedEndpoint(request.Endpoint) || !Key(request.P256dh, 65, out var publicKey) || publicKey[0] != 0x04 || !Key(request.Auth, 16, out _))
            throw new DomainException("push_device_invalid", "This browser's push subscription is not one ParishLife can use.");
        var id = DeviceId(request.Endpoint);
        var key = "pushDevice:" + id;
        var existing = await records.ReadAsync<PushDevice>(Scope, key, ct);
        if (existing is null && (await records.CollectAsync<PushDevice>(Scope, "pushDevice", ct, MaximumDevices + 5)).Count >= MaximumDevices)
            throw new DomainException("push_device_limit", $"Up to {MaximumDevices} devices can receive notifications. Turn one off first.", FailureKind.Conflict);
        var device = new PushDevice
        {
            Id = id, Endpoint = request.Endpoint, P256dh = request.P256dh, Auth = request.Auth,
            Label = string.IsNullOrWhiteSpace(request.Label) ? null : request.Label.Trim(), CreatedAt = existing?.Value.CreatedAt ?? clock.GetUtcNow()
        };
        await CommitAsync("notification.push_device_saved", id, existing is null ? RecordChange.Create(key, "pushDevice", device)
            : RecordChange.Replace(key, "pushDevice", device, existing.Version), new { Kind = "push.device.save", id }, ct);
        return await StatusAsync(ct);
    }

    public async Task<NotificationChannelsDto> RemovePushDeviceAsync(RemovePushDeviceDto request, CancellationToken ct)
    {
        var id = DeviceId(request.Endpoint);
        if (await records.ReadAsync<PushDevice>(Scope, "pushDevice:" + id, ct) is { } existing)
            await CommitAsync("notification.push_device_removed", id, RecordChange.Remove("pushDevice:" + id, existing.Version), new { Kind = "push.device.remove", id }, ct);
        return await StatusAsync(ct);
    }

    public async Task<NotificationChannelsDto> StartWhatsAppAsync(StartWhatsAppDto request, CancellationToken ct)
    {
        if (!whatsApp.Configured)
            throw new DomainException("whatsapp_unavailable", "WhatsApp notices are not set up on this site yet.", FailureKind.Unavailable);
        var existing = await records.ReadAsync<WhatsAppContact>(Scope, DeliveryService.WhatsAppKey, ct);
        if (existing?.Value.SentAt is { } sent && sent > clock.GetUtcNow() - ResendInterval)
            throw new DomainException("whatsapp_code_throttled", "Wait a minute before asking for another code.", FailureKind.Conflict);
        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        var contact = new WhatsAppContact
        {
            Phone = request.Phone, Status = "Pending", CodeHash = Hash(code), ExpiresAt = clock.GetUtcNow().Add(CodeLifetime), SentAt = clock.GetUtcNow()
        };
        // A new number replaces the old one, which stops receiving notices until the new one is proven.
        await CommitAsync("notification.whatsapp_code", actor.AccountId, existing is null
            ? RecordChange.Create(DeliveryService.WhatsAppKey, DeliveryService.WhatsAppKey, contact)
            : RecordChange.Replace(DeliveryService.WhatsAppKey, DeliveryService.WhatsAppKey, contact, existing.Version), new { Kind = "whatsapp.code" }, ct);
        var language = (await records.ReadAsync<NotificationPreferences>(Scope, PreferencesKey, ct))?.Value.Language == "ar" ? "ar" : "en";
        if (!await whatsApp.SendCodeAsync(request.Phone, code, language, ct))
            throw new DomainException("whatsapp_send_failed", "WhatsApp did not accept the code for that number. Check it and try again.", FailureKind.Unavailable);
        return await StatusAsync(ct);
    }

    public async Task<NotificationChannelsDto> ConfirmWhatsAppAsync(ConfirmWhatsAppDto request, CancellationToken ct)
    {
        var row = await records.ReadAsync<WhatsAppContact>(Scope, DeliveryService.WhatsAppKey, ct);
        var contact = row?.Value;
        if (row is null || contact is not { Status: "Pending", CodeHash: not null } || contact.ExpiresAt <= clock.GetUtcNow() || contact.Attempts >= MaximumAttempts)
            throw Invalid();
        if (!CryptographicOperations.FixedTimeEquals(Convert.FromHexString(contact.CodeHash), Convert.FromHexString(Hash(request.Code))))
        {
            contact.Attempts++;
            await CommitAsync("notification.whatsapp_attempt", actor.AccountId,
                RecordChange.Replace(DeliveryService.WhatsAppKey, DeliveryService.WhatsAppKey, contact, row.Version), new { Kind = "whatsapp.attempt" }, ct);
            throw Invalid();
        }
        contact.Status = "Verified";
        contact.CodeHash = null;
        contact.ExpiresAt = null;
        contact.VerifiedAt = clock.GetUtcNow();
        // Proving the number is the person's opt-in to WhatsApp notices.
        var preferences = await records.ReadAsync<NotificationPreferences>(Scope, PreferencesKey, ct);
        var choices = preferences?.Value ?? new NotificationPreferences();
        choices.WhatsApp = true;
        await records.CommitAsync(Scope, Operation.Create(Guid.NewGuid(), actor.AccountId, new { Kind = "whatsapp.verified" }, clock), "notification.whatsapp_verified",
            actor.AccountId,
            [
                RecordChange.Replace(DeliveryService.WhatsAppKey, DeliveryService.WhatsAppKey, contact, row.Version),
                preferences is null ? RecordChange.Create(PreferencesKey, PreferencesKey, choices) : RecordChange.Replace(PreferencesKey, PreferencesKey, choices, preferences.Version)
            ], new CommandResult { Id = actor.AccountId, Status = "Verified" }, ct);
        return await StatusAsync(ct);
    }

    public async Task<NotificationChannelsDto> RemoveWhatsAppAsync(CancellationToken ct)
    {
        var row = await records.ReadAsync<WhatsAppContact>(Scope, DeliveryService.WhatsAppKey, ct);
        var preferences = await records.ReadAsync<NotificationPreferences>(Scope, PreferencesKey, ct);
        var changes = new List<RecordChange>();
        if (row is not null)
            changes.Add(RecordChange.Remove(DeliveryService.WhatsAppKey, row.Version));
        if (preferences is { Value.WhatsApp: true })
        {
            preferences.Value.WhatsApp = false;
            changes.Add(RecordChange.Replace(PreferencesKey, PreferencesKey, preferences.Value, preferences.Version));
        }
        if (changes.Count > 0)
            await records.CommitAsync(Scope, Operation.Create(Guid.NewGuid(), actor.AccountId, new { Kind = "whatsapp.remove" }, clock), "notification.whatsapp_removed",
                actor.AccountId, changes, new CommandResult { Id = actor.AccountId, Status = "Removed" }, ct);
        return await StatusAsync(ct);
    }

    private Task CommitAsync(string action, string id, RecordChange change, object fingerprint, CancellationToken ct)
        => records.CommitAsync(Scope, Operation.Create(Guid.NewGuid(), actor.AccountId, fingerprint, clock), action, id, [change],
            new CommandResult { Id = id, Status = "Saved" }, ct);

    // The code is bound to this account, so a hash leaked from one account proves nothing for another.
    private string Hash(string code) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes("whatsapp\n" + actor.AccountId + "\n" + code)));

    internal static string DeviceId(string endpoint) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(endpoint)))[..32].ToLowerInvariant();

    private static bool Key(string value, int length, out byte[] bytes)
    {
        try
        {
            bytes = Base64Url.DecodeFromChars(value);
            return bytes.Length == length;
        }
        catch (FormatException)
        {
            bytes = [];
            return false;
        }
    }

    private static DomainException Invalid() => new("verification_invalid", "That code is not valid. Ask for a new one.", FailureKind.Forbidden);
}
