// Purpose: sends one Web Push message to one browser or phone with only the platform's cryptography (no outside account, no package):
// the payload is encrypted to the browser's key (RFC 8291, aes128gcm) and the request is signed with this server's VAPID key (RFC 8292).
// Main members: ClientName, Configured, SendAsync (POST to the device's push endpoint), Encrypt (RFC 8291 record, testable with fixed keys),
// VapidToken (ES256 JWT for the endpoint's origin, valid 12 hours) and AllowedEndpoint (only known push services, so a stored endpoint can
// never make this server call an arbitrary address). Payloads, keys and endpoints are never logged.

using System.Buffers.Binary;
using System.Buffers.Text;
using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using ParishLife.Api.Configuration;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Communications;

public class WebPushSender(IHttpClientFactory clients, IOptions<WebPushOptions> options, TimeProvider clock, ILogger<WebPushSender> logger)
{
    public const string ClientName = "WebPush";
    private const int RecordSize = 4096;

    // The push services of Chrome/Android (FCM), Firefox (Mozilla autopush), Edge/Windows (WNS) and Safari/iOS (Apple).
    private static readonly string[] Hosts = ["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"];
    private static readonly string[] HostSuffixes = [".push.services.mozilla.com", ".notify.windows.com", ".push.apple.com"];

    public bool Configured => options.Value.Configured;

    public static bool AllowedEndpoint(string? endpoint)
        => Uri.TryCreate(endpoint, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps && uri.IsDefaultPort
            && string.IsNullOrEmpty(uri.UserInfo) && endpoint!.Length <= 1000
            && (Hosts.Contains(uri.Host, StringComparer.OrdinalIgnoreCase) || HostSuffixes.Any(s => uri.Host.EndsWith(s, StringComparison.OrdinalIgnoreCase)));

    public async Task<PushSendResult> SendAsync(PushDevice device, object payload, CancellationToken ct)
    {
        if (!Configured || !AllowedEndpoint(device.Endpoint))
            return PushSendResult.Failed;
        byte[] body;
        try
        {
            body = Encrypt(Base64Url.DecodeFromChars(device.P256dh), Base64Url.DecodeFromChars(device.Auth), JsonSerializer.SerializeToUtf8Bytes(payload));
        }
        catch (Exception error) when (error is FormatException or CryptographicException or ArgumentException)
        {
            return PushSendResult.Gone; // keys no browser could have made: the row is useless
        }
        var endpoint = new Uri(device.Endpoint);
        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint) { Content = new ByteArrayContent(body) };
        request.Content.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        request.Content.Headers.ContentEncoding.Add("aes128gcm");
        request.Headers.Add("TTL", "86400");
        request.Headers.Add("Urgency", "normal");
        request.Headers.Authorization = new AuthenticationHeaderValue("vapid",
            $"t={VapidToken(endpoint.GetLeftPart(UriPartial.Authority))}, k={options.Value.PublicKey}");
        try
        {
            using var response = await clients.CreateClient(ClientName).SendAsync(request, ct);
            if (response.IsSuccessStatusCode)
                return PushSendResult.Sent;
            if (response.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Gone)
                return PushSendResult.Gone;
            logger.LogWarning("A push service refused a message ({Status}).", (int)response.StatusCode);
            return PushSendResult.Failed;
        }
        catch (Exception error) when (error is HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
        {
            logger.LogWarning("A push service could not be reached ({Error}).", error.GetType().Name);
            return PushSendResult.Failed;
        }
    }

    // RFC 8291 with one aes128gcm record (RFC 8188): salt(16) | record size(4) | key id length(1)=65 | sender public key(65) | ciphertext+tag.
    internal static byte[] Encrypt(byte[] browserPublic, byte[] authSecret, byte[] plaintext, ECDiffieHellman? senderKey = null, byte[]? salt = null)
    {
        if (browserPublic.Length != 65 || browserPublic[0] != 0x04 || authSecret.Length != 16)
            throw new ArgumentException("The browser keys are malformed.");
        if (plaintext.Length > RecordSize - 17)
            throw new ArgumentException("The push message is too long.");
        using var owned = senderKey is null ? ECDiffieHellman.Create(ECCurve.NamedCurves.nistP256) : null;
        var sender = senderKey ?? owned!;
        var point = sender.ExportParameters(false).Q;
        var senderPublic = new byte[65];
        senderPublic[0] = 0x04;
        point.X!.CopyTo(senderPublic, 1);
        point.Y!.CopyTo(senderPublic, 33);
        using var browser = ECDiffieHellman.Create(new ECParameters
        {
            Curve = ECCurve.NamedCurves.nistP256,
            Q = new ECPoint { X = browserPublic[1..33], Y = browserPublic[33..65] }
        });
        var shared = sender.DeriveRawSecretAgreement(browser.PublicKey);
        // IKM = HKDF(salt = auth secret, ikm = ECDH secret, info = "WebPush: info" 0x00 | browser key | sender key, 32 bytes)
        var keyInfo = Encoding.ASCII.GetBytes("WebPush: info\0").Concat(browserPublic).Concat(senderPublic).ToArray();
        var ikm = HKDF.DeriveKey(HashAlgorithmName.SHA256, shared, 32, authSecret, keyInfo);
        salt ??= RandomNumberGenerator.GetBytes(16);
        var prk = HKDF.Extract(HashAlgorithmName.SHA256, ikm, salt);
        var key = HKDF.Expand(HashAlgorithmName.SHA256, prk, 16, Encoding.ASCII.GetBytes("Content-Encoding: aes128gcm\0"));
        var nonce = HKDF.Expand(HashAlgorithmName.SHA256, prk, 12, Encoding.ASCII.GetBytes("Content-Encoding: nonce\0"));
        var record = new byte[plaintext.Length + 1];
        plaintext.CopyTo(record, 0);
        record[^1] = 0x02; // the last (only) record, no padding
        var output = new byte[16 + 4 + 1 + 65 + record.Length + 16];
        salt.CopyTo(output, 0);
        BinaryPrimitives.WriteUInt32BigEndian(output.AsSpan(16, 4), RecordSize);
        output[20] = 65;
        senderPublic.CopyTo(output, 21);
        using var aes = new AesGcm(key, 16);
        aes.Encrypt(nonce, record, output.AsSpan(86, record.Length), output.AsSpan(86 + record.Length, 16));
        return output;
    }

    // RFC 8292: an ES256 JWT for the push service origin, with this server's contact, signed with the VAPID private key.
    internal string VapidToken(string audience)
    {
        var publicKey = Base64Url.DecodeFromChars(options.Value.PublicKey);
        using var key = ECDsa.Create(new ECParameters
        {
            Curve = ECCurve.NamedCurves.nistP256,
            D = Base64Url.DecodeFromChars(options.Value.PrivateKey),
            Q = new ECPoint { X = publicKey[1..33], Y = publicKey[33..65] }
        });
        var header = Base64Url.EncodeToString("""{"typ":"JWT","alg":"ES256"}"""u8);
        var claims = Base64Url.EncodeToString(JsonSerializer.SerializeToUtf8Bytes(new
        {
            aud = audience, exp = clock.GetUtcNow().AddHours(12).ToUnixTimeSeconds(), sub = options.Value.Subject
        }));
        var signature = key.SignData(Encoding.ASCII.GetBytes(header + "." + claims), HashAlgorithmName.SHA256); // IEEE P1363 r|s, as JWS needs
        return header + "." + claims + "." + Base64Url.EncodeToString(signature);
    }
}
