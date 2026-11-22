// Purpose: "Send a test notification" on My account: one fixed, neutral message to the caller alone, on every outside channel they set up
// (their own push devices, their own confirmed email, their own proven WhatsApp number), so they can check delivery live.
// Main functions: SendAsync (personal sign-in only; an account with two-factor needs its authenticator session; one test a minute and
// five a day per account, counted before sending), and the per-channel result mapping. It takes no recipient, text or link input. Results
// are "sent" only when the push service, Resend or WhatsApp accepted the message; dead push devices are removed as in normal delivery.
// Nothing about devices, addresses or results enters receipts or audit; the log holds only outcomes and the device count.

using ParishLife.Api.DTOs.Communications;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Communications;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;
using Microsoft.Extensions.Options;
using ParishLife.Api.Configuration;

namespace ParishLife.Api.Services.Communications;

public class NotificationTestService(IRecordTransactions records, ICurrentActor actor, MfaAccountAccess proof, DeliveryService delivery,
    IOptions<DeliveryOptions> options, TimeProvider clock, ILogger<NotificationTestService> logger)
{
    internal const int DailyLimit = 5;
    internal static readonly TimeSpan Interval = TimeSpan.FromMinutes(1);
    private const string Key = "notificationTest";

    public async Task<NotificationTestDto> SendAsync(CancellationToken ct)
    {
        if (proof.RecoverySession || actor.ActingAppointmentId is not null)
            throw new DomainException("personal_capacity_required", "Use a normal personal sign-in to test notifications.", FailureKind.Forbidden);
        var user = await proof.CurrentAsync(ct);
        if (user.TwoFactorEnabled || user.PlatformOperator)
            await proof.RequireMfaAsync(ct);

        var scope = new RecordScope { Area = RecordArea.Account, OwnerId = actor.AccountId };
        var now = clock.GetUtcNow();
        var today = DateOnly.FromDateTime(now.UtcDateTime);
        var row = await records.ReadAsync<NotificationTestLog>(scope, Key, ct);
        if (row is not null && row.Value.LastAt > now - Interval)
            throw new DomainException("notification_test_throttled", "Wait a minute before sending another test.", FailureKind.Conflict);
        var log = row is { Value.Day: var day } && day == today ? row.Value : new NotificationTestLog { Day = today };
        if (log.Count >= DailyLimit)
            throw new DomainException("notification_test_limit", $"You can send up to {DailyLimit} test notifications a day. Try again tomorrow.", FailureKind.Conflict);
        log.Count++;
        log.LastAt = now;
        // Counted before anything is sent, so a failure or a lost answer still uses up a test.
        await records.CommitAsync(scope, Operation.Create(Guid.NewGuid(), actor.AccountId, new { Kind = "notification.test" }, clock), "notification.test",
            actor.AccountId, [row is null ? RecordChange.Create(Key, Key, log) : RecordChange.Replace(Key, Key, log, row.Version)],
            new CommandResult { Id = actor.AccountId, Status = "Counted" }, ct);

        var target = await delivery.TargetAsync(actor.AccountId, ct)
            ?? throw new DomainException("account_unavailable", "The current account is unavailable.", FailureKind.Forbidden);
        var ar = target.Preferences.Language == "ar";
        var message = new DeliveryMessage
        {
            Title = ar ? "إشعار تجريبي من ParishLife: الإشعارات تعمل." : "ParishLife test notification: notifications are working.",
            Body = ar ? "طلبت هذا الاختبار من «حسابي». لا حاجة إلى أي إجراء." : "You asked for this test under My account. No action is needed.",
            Link = options.Value.SiteUrl.TrimEnd('/') + "/index.html",
            Language = ar ? "ar" : "en"
        };
        var devices = target.Devices.Count;
        var result = new NotificationTestDto
        {
            Push = await ChannelAsync("Push", target.Preferences.Push, devices > 0, "no-device", target, message, ct),
            Email = await ChannelAsync("Email", target.Preferences.Email, target.Email is not null, "no-address", target, message, ct),
            WhatsApp = await ChannelAsync("WhatsApp", target.Preferences.WhatsApp, target.Phone is not null, "no-number", target, message, ct),
            RemainingToday = DailyLimit - log.Count
        };
        logger.LogInformation("Test notification: push {Push} ({Devices} devices), email {Email}, WhatsApp {WhatsApp}.",
            result.Push, devices, result.Email, result.WhatsApp);
        return result;
    }

    // not-enabled: not set up here, or the person turned it off; missing: nothing to send to; otherwise what the provider answered.
    // A push whose every device turned out to be gone (and was removed) reports no-device.
    private async Task<string> ChannelAsync(string name, bool chosen, bool reachable, string missing, DeliveryTarget target, DeliveryMessage message,
        CancellationToken ct)
    {
        if (delivery.Channels.FirstOrDefault(channel => channel.Name == name) is not IDeliveryChannel channel || !chosen)
            return "not-enabled";
        if (!reachable)
            return missing;
        return await channel.SendAsync(target, message, ct) switch
        {
            DeliveryOutcome.Sent => "sent",
            DeliveryOutcome.Failed => "failed",
            _ => missing
        };
    }
}
