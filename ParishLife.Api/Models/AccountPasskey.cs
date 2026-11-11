// Purpose: stores one registered WebAuthn passkey on the account document (public material only; no private key exists server-side).
// Main members: CredentialId (base64url), PublicKey (COSE, base64), Name, CreatedAt, LastUsedAt, SignCount, Transports and flags.

namespace ParishLife.Api.Models;

public class AccountPasskey
{
    public string CredentialId { get; set; } = string.Empty;

    public string PublicKey { get; set; } = string.Empty;

    public string Name { get; set; } = "Passkey";

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset? LastUsedAt { get; set; }

    public uint SignCount { get; set; }

    public List<string> Transports { get; set; } = [];

    public bool IsUserVerified { get; set; }

    public bool IsBackupEligible { get; set; }

    public bool IsBackedUp { get; set; }
}
