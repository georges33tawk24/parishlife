// Purpose: supplies fixture-only TOTP values for randomly generated test enrollment keys; production verification remains ASP.NET Core Identity.
// Main function: Code decodes the fixture Base32 key and computes the current (or a neighbouring step's) test response for actual
// provider checks.

using System.Buffers.Binary;
using System.Security.Cryptography;

namespace ParishLife.IntegrationTests.Support;

internal static class TestAuthenticator
{
    public const string InitialSecret = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

    // step: a neighbouring 30-second step (Identity accepts two either side), for a second sign-in while the current code is spent.
    public static string Code(string secret = InitialSecret, int step = 0)
    {
        const string alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        var bytes = new List<byte>();
        var buffer = 0;
        var bits = 0;
        foreach (var character in secret)
        {
            var value = alphabet.IndexOf(character);
            if (value < 0)
                throw new InvalidOperationException("Invalid fixture key.");
            buffer = (buffer << 5) | value;
            bits += 5;
            if (bits >= 8)
            {
                bits -= 8;
                bytes.Add((byte)(buffer >> bits));
                buffer &= (1 << bits) - 1;
            }
        }
        Span<byte> counter = stackalloc byte[8];
        BinaryPrimitives.WriteInt64BigEndian(counter, DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 30 + step);
        var hash = HMACSHA1.HashData(bytes.ToArray(), counter);
        var offset = hash[^1] & 15;
        var number = BinaryPrimitives.ReadInt32BigEndian(hash.AsSpan(offset, 4)) & int.MaxValue;
        return (number % 1_000_000).ToString("D6", System.Globalization.CultureInfo.InvariantCulture);
    }
}
