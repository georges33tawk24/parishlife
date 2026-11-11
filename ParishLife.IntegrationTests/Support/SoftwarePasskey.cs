// Purpose: fixture-only WebAuthn software authenticator (P-256, "none" attestation) so tests drive the real Identity passkey handler.
// Main functions: Attest builds a PublicKeyCredential creation JSON; Assert signs a request challenge; Cbor writes the minimal CBOR subset.

using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace ParishLife.IntegrationTests.Support;

internal sealed class SoftwarePasskey(bool countSignatures = false) : IDisposable
{
    public const string Origin = "https://localhost";
    private readonly ECDsa key = ECDsa.Create(ECCurve.NamedCurves.nistP256);
    private readonly byte[] credentialId = RandomNumberGenerator.GetBytes(16);
    private uint counter;
    private string userHandle = string.Empty;

    public string Id => B64(credentialId);

    public string Attest(string optionsJson, string origin = Origin)
    {
        using var options = JsonDocument.Parse(optionsJson);
        var root = options.RootElement;
        userHandle = root.GetProperty("user").GetProperty("id").GetString()!;
        var rpId = root.TryGetProperty("rp", out var rp) && rp.TryGetProperty("id", out var id) ? id.GetString()! : "localhost";
        var clientData = ClientData("webauthn.create", root.GetProperty("challenge").GetString()!, origin);
        var parameters = key.ExportParameters(false);
        var cose = Cbor.Map((Cbor.Int(1), Cbor.Int(2)), (Cbor.Int(3), Cbor.Int(-7)), (Cbor.Int(-1), Cbor.Int(1)),
            (Cbor.Int(-2), Cbor.Bytes(parameters.Q.X!)), (Cbor.Int(-3), Cbor.Bytes(parameters.Q.Y!)));
        var authData = Concat(SHA256.HashData(Encoding.UTF8.GetBytes(rpId)), [0x45], Counter(), new byte[16],
            [(byte)(credentialId.Length >> 8), (byte)credentialId.Length], credentialId, cose);
        var attestation = Cbor.Map((Cbor.Text("fmt"), Cbor.Text("none")), (Cbor.Text("attStmt"), Cbor.Map()), (Cbor.Text("authData"), Cbor.Bytes(authData)));
        return JsonSerializer.Serialize(new
        {
            id = Id, rawId = Id, type = "public-key", authenticatorAttachment = "platform", clientExtensionResults = new { },
            response = new { clientDataJSON = B64(clientData), attestationObject = B64(attestation), transports = new[] { "internal" } }
        });
    }

    public string Assert(string optionsJson, string origin = Origin)
    {
        using var options = JsonDocument.Parse(optionsJson);
        var root = options.RootElement;
        var rpId = root.TryGetProperty("rpId", out var id) ? id.GetString()! : "localhost";
        var clientData = ClientData("webauthn.get", root.GetProperty("challenge").GetString()!, origin);
        if (countSignatures)
            counter++;
        var authData = Concat(SHA256.HashData(Encoding.UTF8.GetBytes(rpId)), [0x05], Counter());
        var signature = key.SignData(Concat(authData, SHA256.HashData(clientData)), HashAlgorithmName.SHA256, DSASignatureFormat.Rfc3279DerSequence);
        return JsonSerializer.Serialize(new
        {
            id = Id, rawId = Id, type = "public-key", clientExtensionResults = new { },
            response = new { clientDataJSON = B64(clientData), authenticatorData = B64(authData), signature = B64(signature), userHandle }
        });
    }

    private byte[] Counter() => [(byte)(counter >> 24), (byte)(counter >> 16), (byte)(counter >> 8), (byte)counter];

    private static byte[] ClientData(string type, string challenge, string origin)
        => JsonSerializer.SerializeToUtf8Bytes(new { type, challenge, origin, crossOrigin = false });

    private static byte[] Concat(params byte[][] parts) => parts.SelectMany(part => part).ToArray();

    internal static string B64(byte[] value) => Convert.ToBase64String(value).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    public void Dispose() => key.Dispose();

    private static class Cbor
    {
        public static byte[] Int(int value) => value >= 0 ? Head(0, (ulong)value) : Head(1, (ulong)(-1 - value));
        public static byte[] Bytes(byte[] value) => Concat(Head(2, (ulong)value.Length), value);
        public static byte[] Text(string value) => Concat(Head(3, (ulong)Encoding.UTF8.GetByteCount(value)), Encoding.UTF8.GetBytes(value));
        public static byte[] Map(params (byte[] Key, byte[] Value)[] entries)
            => Concat([Head(5, (ulong)entries.Length), .. entries.SelectMany(entry => new[] { entry.Key, entry.Value })]);

        private static byte[] Head(int major, ulong length) => length switch
        {
            < 24 => [(byte)(major << 5 | (int)length)],
            < 256 => [(byte)(major << 5 | 24), (byte)length],
            _ => [(byte)(major << 5 | 25), (byte)(length >> 8), (byte)length]
        };
    }
}
