// Purpose: generates pickup codes and checks them against the stored salted hash; the plain code is never stored, logged or fingerprinted.
// Main functions: Issue (returns the plain code once with its salt and hash), Normalize and Matches (constant-time comparison).

using System.Security.Cryptography;
using System.Text;
using ParishLife.Api.Models;

namespace ParishLife.Api.Services.Registrations;

internal static class PickupCodes
{
    // No 0/O, 1/I/L, so a code read aloud or from paper is not misread; 8 characters of 31 give about 40 bits.
    private const string Alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

    public static (string Code, string Salt, string Hash) Issue()
    {
        var code = RandomNumberGenerator.GetString(Alphabet, 8);
        var salt = Convert.ToHexString(RandomNumberGenerator.GetBytes(16));
        return (code, salt, Hash(salt, code));
    }

    public static string Normalize(string code) => new(code.Where(c => !char.IsWhiteSpace(c) && c != '-').Select(char.ToUpperInvariant).ToArray());

    public static bool Matches(EventRegistration item, string? code)
    {
        if (item.PickupCodeHash is null || item.PickupCodeSalt is null || string.IsNullOrWhiteSpace(code) || code.Length > 32)
            return false;
        var expected = Convert.FromHexString(item.PickupCodeHash);
        var actual = Convert.FromHexString(Hash(item.PickupCodeSalt, Normalize(code)));
        return CryptographicOperations.FixedTimeEquals(expected, actual);
    }

    private static string Hash(string salt, string code)
        => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(salt + ":" + code)));
}
