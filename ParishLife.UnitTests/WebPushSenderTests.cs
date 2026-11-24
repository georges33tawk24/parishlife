// Purpose: unit tests for the Web Push cryptography in WebPushSender, against the published RFC 8291 example and the VAPID rules.
// Main tests: Encrypt reproduces RFC 8291 Appendix A byte for byte from its keys and salt; the VAPID token is an ES256 JWT for the push
// service origin that verifies with the public key and expires within a day; only known push services are allowed as endpoints.

using System.Buffers.Text;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using ParishLife.Api.Configuration;
using ParishLife.Api.Services.Communications;
using Xunit;

namespace ParishLife.UnitTests;

public class WebPushSenderTests
{
    [Fact]
    public void Encrypt_reproduces_the_RFC_8291_example_byte_for_byte()
    {
        // RFC 8291, Appendix A (record size 4096).
        var plaintext = Base64Url.DecodeFromChars("V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24");
        var serverPublic = Base64Url.DecodeFromChars("BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8");
        var serverPrivate = Base64Url.DecodeFromChars("yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw");
        var browserPublic = Base64Url.DecodeFromChars("BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4");
        var auth = Base64Url.DecodeFromChars("BTBZMqHH6r4Tts7J_aSIgg");
        var salt = Base64Url.DecodeFromChars("DGv6ra1nlYgDCS1FRnbzlw");
        const string header = "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8";
        const string ciphertext = "8pfeW0KbunFT06SuDKoJH9Ql87S1QUrdirN6GcG7sFz1y1sqLgVi1VhjVkHsUoEsbI_0LpXMuGvnzQ";
        using var server = ECDiffieHellman.Create(new ECParameters
        {
            Curve = ECCurve.NamedCurves.nistP256, D = serverPrivate,
            Q = new ECPoint { X = serverPublic[1..33], Y = serverPublic[33..65] }
        });
        var message = WebPushSender.Encrypt(browserPublic, auth, plaintext, server, salt);
        Assert.Equal(header, Base64Url.EncodeToString(message.AsSpan(0, 86)));
        Assert.Equal(ciphertext, Base64Url.EncodeToString(message.AsSpan(86)));
    }

    [Fact]
    public void Vapid_token_is_an_ES256_JWT_for_the_push_origin_that_verifies_with_the_public_key()
    {
        using var key = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        var parameters = key.ExportParameters(true);
        var publicKey = Base64Url.EncodeToString([0x04, .. parameters.Q.X!, .. parameters.Q.Y!]);
        var sender = new WebPushSender(null!, Options.Create(new WebPushOptions
        {
            PublicKey = publicKey, PrivateKey = Base64Url.EncodeToString(parameters.D!), Subject = "mailto:privacy@parish-life.org"
        }), TimeProvider.System, NullLogger<WebPushSender>.Instance);

        var token = sender.VapidToken("https://fcm.googleapis.com");
        var parts = token.Split('.');
        Assert.Equal(3, parts.Length);
        Assert.True(key.VerifyData(Encoding.ASCII.GetBytes(parts[0] + "." + parts[1]), Base64Url.DecodeFromChars(parts[2]), HashAlgorithmName.SHA256));
        using var head = JsonDocument.Parse(Base64Url.DecodeFromChars(parts[0]));
        Assert.Equal("ES256", head.RootElement.GetProperty("alg").GetString());
        using var claims = JsonDocument.Parse(Base64Url.DecodeFromChars(parts[1]));
        Assert.Equal("https://fcm.googleapis.com", claims.RootElement.GetProperty("aud").GetString());
        Assert.Equal("mailto:privacy@parish-life.org", claims.RootElement.GetProperty("sub").GetString());
        var expires = DateTimeOffset.FromUnixTimeSeconds(claims.RootElement.GetProperty("exp").GetInt64());
        Assert.InRange(expires, DateTimeOffset.UtcNow.AddHours(11), DateTimeOffset.UtcNow.AddHours(24)); // RFC 8292: at most 24 hours
    }

    [Theory]
    [InlineData("https://fcm.googleapis.com/fcm/send/abc", true)]
    [InlineData("https://updates.push.services.mozilla.com/wpush/v2/abc", true)]
    [InlineData("https://wns2-par02p.notify.windows.com/w/?token=abc", true)]
    [InlineData("https://web.push.apple.com/QGFk", true)]
    [InlineData("http://fcm.googleapis.com/fcm/send/abc", false)]
    [InlineData("https://fcm.googleapis.com:8443/fcm/send/abc", false)]
    [InlineData("https://evil.example/fcm.googleapis.com", false)]
    [InlineData("https://notify.windows.com.evil.example/x", false)]
    [InlineData("https://169.254.169.254/metadata", false)]
    [InlineData("not a url", false)]
    public void Only_known_push_services_are_allowed_as_endpoints(string endpoint, bool allowed)
        => Assert.Equal(allowed, WebPushSender.AllowedEndpoint(endpoint));
}
