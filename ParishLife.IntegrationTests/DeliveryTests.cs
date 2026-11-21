// Purpose: verifies outside delivery of notices and broadcasts (email through Resend, Web Push, WhatsApp) over real HTTP and the real queue,
// with isolated stand-ins for Resend, a push service and Meta's WhatsApp API.
// Main tests: a stored notice reaches a confirmed email and a registered push device (encrypted, VAPID-signed), WhatsApp only after the number
// is proven with its code; a push device the service reports gone is removed; unknown push endpoints are refused; a failed channel is retried
// without repeating the channels already sent, and channel choices are kept and honoured; a sent broadcast reaches its recipients in their
// language, only at confirmed addresses; nothing is queued while no channel is configured.

using System.Buffers.Text;
using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Communications;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Communications;
using ParishLife.IntegrationTests.Support;
using Xunit;
using static ParishLife.IntegrationTests.Support.AuthHttp;

namespace ParishLife.IntegrationTests;

public class DeliveryTests
{
    private const string Endpoint = "https://fcm.googleapis.com/fcm/send/isolated-device";

    [Fact]
    public async Task A_notice_goes_to_email_and_push_and_to_WhatsApp_only_once_the_number_is_proven()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var (member, email) = await ConfirmedMemberAsync(f);
        var stand = new StandIns();
        await using var factory = Factory(f, stand);
        using var client = factory.Client();
        await LoginAsync(client, email);

        var channels = await Read<NotificationChannelsDto>(await client.GetAsync("/api/notifications/channels"));
        Assert.True(channels.Email && channels.Push && channels.WhatsApp && channels.EmailAddressConfirmed);
        Assert.Equal(stand.VapidPublic, channels.PushPublicKey);
        // Only known push services: a stored endpoint must never make the server call an arbitrary address.
        var browser = new BrowserKeys();
        Assert.Equal("push_device_invalid", await Title(await client.PostAsJsonAsync("/api/notifications/push-devices",
            new SavePushDeviceDto { Endpoint = "https://169.254.169.254/latest", P256dh = browser.Public, Auth = browser.Auth })));
        Assert.Equal(1, (await Read<NotificationChannelsDto>(await client.PostAsJsonAsync("/api/notifications/push-devices",
            new SavePushDeviceDto { Endpoint = Endpoint, P256dh = browser.Public, Auth = browser.Auth, Label = "Phone" }))).PushDevices);

        await NotifyAsync(factory, member, "There is an update to your request.", "n1");
        await ProcessAsync(factory);
        var mail = Assert.Single(stand.Resend);
        Assert.Contains(email, mail.Body);
        Assert.Contains("There is an update to your request.", mail.Body);
        Assert.Contains("https://parish-life.org/index.html", mail.Body);
        var push = Assert.Single(stand.Push);
        Assert.Equal("aes128gcm", push.Encoding);
        Assert.StartsWith("vapid t=", push.Authorization);
        Assert.Contains("k=" + stand.VapidPublic, push.Authorization);
        using (var payload = JsonDocument.Parse(browser.Decrypt(push.Bytes)))
        {
            Assert.Equal("There is an update to your request.", payload.RootElement.GetProperty("title").GetString());
            Assert.Equal("https://parish-life.org/index.html", payload.RootElement.GetProperty("url").GetString());
        }
        Assert.Empty(stand.WhatsApp); // no proven number yet
        Assert.Empty(await QueueAsync(factory, RecordArea.Account));

        // Prove a WhatsApp number: a code goes to it through the authentication template; a wrong code is refused.
        await Read<NotificationChannelsDto>(await client.PostAsJsonAsync("/api/notifications/whatsapp", new StartWhatsAppDto { Phone = "+9613123456" }));
        var codeMessage = Assert.Single(stand.WhatsApp);
        Assert.Contains("\"name\":\"parishlife_code\"", codeMessage.Body);
        Assert.Contains("\"to\":\"9613123456\"", codeMessage.Body);
        var code = JsonDocument.Parse(codeMessage.Body).RootElement.GetProperty("template").GetProperty("components")[0]
            .GetProperty("parameters")[0].GetProperty("text").GetString()!;
        Assert.Equal("verification_invalid", await Title(await client.PostAsJsonAsync("/api/notifications/whatsapp/confirm",
            new ConfirmWhatsAppDto { Code = code == "000000" ? "111111" : "000000" })));
        Assert.Equal("Verified", (await Read<NotificationChannelsDto>(await client.PostAsJsonAsync("/api/notifications/whatsapp/confirm",
            new ConfirmWhatsAppDto { Code = code }))).WhatsAppStatus);
        Assert.True((await Read<NotificationPreferencesDto>(await client.GetAsync("/api/notifications/preferences"))).WhatsApp);
        await AssertNoCodeStoredAsync(factory, member, code);

        // Now the notice also goes out on WhatsApp; and a push device the service reports gone is removed.
        stand.PushStatus = HttpStatusCode.Gone;
        await NotifyAsync(factory, member, "You have a new message from your parish.", "n2");
        await ProcessAsync(factory);
        var notice = stand.WhatsApp[^1].Body;
        Assert.Contains("\"name\":\"parishlife_notice\"", notice);
        Assert.Contains("You have a new message from your parish.", notice);
        Assert.Equal(0, (await Read<NotificationChannelsDto>(await client.GetAsync("/api/notifications/channels"))).PushDevices);
        Assert.Empty(await QueueAsync(factory, RecordArea.Account));
    }

    [Fact]
    public async Task A_failed_channel_is_retried_without_repeating_the_others_and_choices_are_kept()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var (member, email) = await ConfirmedMemberAsync(f);
        var stand = new StandIns { ResendStatus = HttpStatusCode.InternalServerError };
        await using var factory = Factory(f, stand);
        using var client = factory.Client();
        await LoginAsync(client, email);
        var browser = new BrowserKeys();
        await Read<NotificationChannelsDto>(await client.PostAsJsonAsync("/api/notifications/push-devices",
            new SavePushDeviceDto { Endpoint = Endpoint, P256dh = browser.Public, Auth = browser.Auth }));

        await NotifyAsync(factory, member, "There is an update to your request.", "r1");
        await ProcessAsync(factory);
        var queued = Assert.Single(await QueueAsync(factory, RecordArea.Account));
        Assert.Equal(1, queued.Attempts);
        Assert.Contains("Push", queued.DoneChannels);
        stand.ResendStatus = HttpStatusCode.OK;
        await ProcessAsync(factory);
        Assert.Equal(2, stand.Resend.Count); // the failed try, then the retry
        Assert.Single(stand.Push);          // push was not repeated
        Assert.Empty(await QueueAsync(factory, RecordArea.Account));

        // Email off: kept by a later save that leaves the channels out (an older screen), and honoured.
        await Read<NotificationPreferencesDto>(await client.PutAsJsonAsync("/api/notifications/preferences",
            new { mutedTopics = Array.Empty<string>(), language = "en", digestOptional = false, email = false }));
        var kept = await Read<NotificationPreferencesDto>(await client.PutAsJsonAsync("/api/notifications/preferences",
            new { mutedTopics = Array.Empty<string>(), language = "en", digestOptional = false }));
        Assert.False(kept.Email);
        Assert.True(kept.Push);
        await NotifyAsync(factory, member, "There is an update to your request.", "r2");
        await ProcessAsync(factory);
        Assert.Equal(2, stand.Resend.Count);
        Assert.Equal(2, stand.Push.Count);
    }

    [Fact]
    public async Task A_sent_broadcast_reaches_its_recipients_in_their_language_at_confirmed_addresses_only()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var (english, englishEmail) = await ConfirmedMemberAsync(f);
        var (arabic, arabicEmail) = await ConfirmedMemberAsync(f);
        var unconfirmed = await f.CreateVerifiedMemberAsync();
        var stand = new StandIns();
        await using var factory = Factory(f, stand);
        using var client = factory.Client();
        await LoginAsync(client, arabicEmail);
        await Read<NotificationPreferencesDto>(await client.PutAsJsonAsync("/api/notifications/preferences",
            new { mutedTopics = Array.Empty<string>(), language = "ar", digestOptional = false }));

        var parish = Guid.NewGuid().ToString("N");
        var broadcast = new Broadcast
        {
            Id = Guid.NewGuid().ToString("N"), ParishId = parish, Title = "Christmas Mass times", Body = "Midnight Mass at 11:30 pm.",
            TitleAr = "مواعيد قداديس الميلاد", BodyAr = "قداس منتصف الليل الساعة ١١:٣٠.", Status = "Sent", RecipientAccountIds = [english, arabic, unconfirmed]
        };
        using (var scope = factory.Services.CreateScope())
        {
            var queue = scope.ServiceProvider.GetRequiredService<DeliveryQueue>();
            await scope.ServiceProvider.GetRequiredService<IRecordTransactions>().CommitAsync(new RecordScope { Area = RecordArea.Parish, OwnerId = parish },
                Operation.Create(Guid.NewGuid(), "isolated-test", new { broadcast.Id }, TimeProvider.System), "test.broadcast_sent", broadcast.Id,
                [RecordChange.Create("broadcast:" + broadcast.Id, "broadcast", broadcast), queue.BroadcastWork(broadcast)!],
                new CommandResult { Id = broadcast.Id, Status = "Sent" }, default);
        }
        await ProcessAsync(factory);
        Assert.Equal(2, stand.Resend.Count);
        var toEnglish = Assert.Single(stand.Resend, m => m.Body.Contains(englishEmail));
        Assert.Contains("Christmas Mass times", toEnglish.Body);
        Assert.Contains("Midnight Mass", toEnglish.Body);
        var toArabic = Assert.Single(stand.Resend, m => m.Body.Contains(arabicEmail));
        Assert.Contains("مواعيد قداديس الميلاد", JsonDocument.Parse(toArabic.Body).RootElement.GetProperty("subject").GetString());
        Assert.Empty(await QueueAsync(factory, RecordArea.Parish));
    }

    [Fact]
    public async Task Nothing_is_queued_while_no_outside_channel_is_configured()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var (member, _) = await ConfirmedMemberAsync(f);
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var scope = factory.Services.CreateScope();
        Assert.False(scope.ServiceProvider.GetRequiredService<DeliveryQueue>().AnyConfigured);
        await scope.ServiceProvider.GetRequiredService<NotificationService>().NotifyAsync(member, null, "test.topic", "Title", null, true, "u1", default);
        Assert.Empty(await QueueAsync(factory, RecordArea.Account));
        using var client = factory.Client();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/notifications/channels")).StatusCode);
    }

    private static async Task<(string Id, string Email)> ConfirmedMemberAsync(LocalBackendFixture f)
    {
        var id = await f.CreateVerifiedMemberAsync();
        var users = f.Services.GetRequiredService<UserManager<ParishUser>>();
        var user = (await users.FindByIdAsync(id))!;
        user.EmailConfirmed = true;
        Assert.True((await users.UpdateAsync(user)).Succeeded);
        return (id, user.Email!);
    }

    private static async Task NotifyAsync(ConfiguredApiFactory factory, string account, string title, string key)
    {
        using var scope = factory.Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<NotificationService>().NotifyAsync(account, null, "test.topic", title, null, true, key, default);
    }

    private static async Task ProcessAsync(ConfiguredApiFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var processor = scope.ServiceProvider.GetRequiredService<DeliveryProcessor>();
        await processor.ProcessNoticesAsync(null, default);
        await processor.ProcessBroadcastsAsync(null, default);
    }

    private static async Task<List<DeliveryWork>> QueueAsync(LocalApiFactory factory, RecordArea area)
    {
        using var scope = factory.Services.CreateScope();
        var page = await scope.ServiceProvider.GetRequiredService<IRecordTransactions>().ScanWorkAsync<DeliveryWork>(area, DeliveryQueue.Type, 100, null, default);
        return page.Items.Select(row => row.Value).ToList();
    }

    private static async Task AssertNoCodeStoredAsync(ConfiguredApiFactory factory, string account, string code)
    {
        using var scope = factory.Services.CreateScope();
        var records = scope.ServiceProvider.GetRequiredService<IRecordTransactions>();
        var stored = JsonSerializer.Serialize(new
        {
            Contact = await records.ReadAsync<JsonElement>(new RecordScope { Area = RecordArea.Account, OwnerId = account }, DeliveryService.WhatsAppKey, default),
            Audit = await records.PageAsync<JsonElement>(new RecordScope { Area = RecordArea.Account, OwnerId = account }, "audit", 100, null, default),
            Receipts = await records.PageAsync<JsonElement>(new RecordScope { Area = RecordArea.Account, OwnerId = account }, "operation", 100, null, default)
        });
        Assert.DoesNotContain("\"" + code + "\"", stored, StringComparison.Ordinal);
    }

    private static ConfiguredApiFactory Factory(LocalBackendFixture f, StandIns stand) => new(f.DirectoryPath, new()
    {
        ["Email:Provider"] = "Resend",
        ["Email:ResendApiKey"] = "isolated-resend-key",
        ["Email:From"] = "ParishLife <no-reply@parish-life.org>",
        ["WebPush:PublicKey"] = stand.VapidPublic,
        ["WebPush:PrivateKey"] = stand.VapidPrivate,
        ["WhatsApp:PhoneNumberId"] = "isolated-phone-id",
        ["WhatsApp:AccessToken"] = "isolated-whatsapp-token"
    }, services =>
    {
        services.AddHttpClient(ResendEmailSender.ClientName).ConfigurePrimaryHttpMessageHandler(() => stand.Handler("resend"));
        services.AddHttpClient(WebPushSender.ClientName).ConfigurePrimaryHttpMessageHandler(() => stand.Handler("push"));
        services.AddHttpClient(WhatsAppSender.ClientName).ConfigurePrimaryHttpMessageHandler(() => stand.Handler("whatsapp"));
    });

    // Records every outside request and answers as Resend, a push service and the WhatsApp API would.
    private sealed class StandIns
    {
        public List<Captured> Resend { get; } = [];
        public List<Captured> Push { get; } = [];
        public List<Captured> WhatsApp { get; } = [];
        public HttpStatusCode ResendStatus { get; set; } = HttpStatusCode.OK;
        public HttpStatusCode PushStatus { get; set; } = HttpStatusCode.Created;
        public string VapidPublic { get; }
        public string VapidPrivate { get; }

        public StandIns()
        {
            using var key = ECDsa.Create(ECCurve.NamedCurves.nistP256);
            var p = key.ExportParameters(true);
            VapidPublic = Base64Url.EncodeToString([0x04, .. p.Q.X!, .. p.Q.Y!]);
            VapidPrivate = Base64Url.EncodeToString(p.D!);
        }

        public HttpMessageHandler Handler(string kind) => new Recorder(async request =>
        {
            var bytes = request.Content is null ? [] : await request.Content.ReadAsByteArrayAsync();
            var captured = new Captured(request.RequestUri!.ToString(), Encoding.UTF8.GetString(bytes), bytes,
                request.Content?.Headers.ContentEncoding.FirstOrDefault(), request.Headers.Authorization?.ToString() ?? string.Empty);
            switch (kind)
            {
                case "resend":
                    Resend.Add(captured);
                    return new HttpResponseMessage(ResendStatus) { Content = new StringContent("{}") };
                case "push":
                    Push.Add(captured);
                    return new HttpResponseMessage(PushStatus);
                default:
                    WhatsApp.Add(captured);
                    return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("""{"messages":[{"id":"wamid.isolated"}]}""") };
            }
        });
    }

    private sealed record Captured(string Uri, string Body, byte[] Bytes, string? Encoding, string Authorization);

    private sealed class Recorder(Func<HttpRequestMessage, Task<HttpResponseMessage>> answer) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) => answer(request);
    }

    // A browser's push subscription keys, and the browser side of RFC 8291 to read what the server sent.
    private sealed class BrowserKeys
    {
        private readonly ECDiffieHellman key = ECDiffieHellman.Create(ECCurve.NamedCurves.nistP256);
        private readonly byte[] auth = RandomNumberGenerator.GetBytes(16);
        private readonly byte[] publicKey;

        public BrowserKeys()
        {
            var q = key.ExportParameters(false).Q;
            publicKey = [0x04, .. q.X!, .. q.Y!];
        }

        public string Public => Base64Url.EncodeToString(publicKey);
        public string Auth => Base64Url.EncodeToString(auth);

        public byte[] Decrypt(byte[] message)
        {
            var salt = message[..16];
            var senderPublic = message[21..86];
            using var sender = ECDiffieHellman.Create(new ECParameters
            { Curve = ECCurve.NamedCurves.nistP256, Q = new ECPoint { X = senderPublic[1..33], Y = senderPublic[33..65] } });
            var shared = key.DeriveRawSecretAgreement(sender.PublicKey);
            var ikm = HKDF.DeriveKey(HashAlgorithmName.SHA256, shared, 32, auth,
                [.. System.Text.Encoding.ASCII.GetBytes("WebPush: info\0"), .. publicKey, .. senderPublic]);
            var prk = HKDF.Extract(HashAlgorithmName.SHA256, ikm, salt);
            var cek = HKDF.Expand(HashAlgorithmName.SHA256, prk, 16, System.Text.Encoding.ASCII.GetBytes("Content-Encoding: aes128gcm\0"));
            var nonce = HKDF.Expand(HashAlgorithmName.SHA256, prk, 12, System.Text.Encoding.ASCII.GetBytes("Content-Encoding: nonce\0"));
            var body = message[86..];
            var plain = new byte[body.Length - 16];
            using var aes = new AesGcm(cek, 16);
            aes.Decrypt(nonce, body[..^16], body[^16..], plain);
            Assert.Equal(0x02, plain[^1]); // the single, last record
            return plain[..^1];
        }
    }
}
