// Purpose: safe projection of a registered passkey; public-key material and sign counters are not returned.
// Main members: Id (credential ID, base64url), Name, CreatedAt, LastUsedAt, IsBackedUp.

namespace ParishLife.Api.DTOs.Accounts;

public class PasskeyDto
{
    public string Id { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset? LastUsedAt { get; set; }

    public bool IsBackedUp { get; set; }
}
