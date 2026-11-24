// Purpose: one browser or phone that agreed to receive ParishLife push notifications for an account (Web Push subscription).
// Main members: Id (hash of the endpoint), Endpoint (a known push service URL), P256dh and Auth (the browser's public key and secret,
// used only to encrypt messages to it), Label and CreatedAt. Stored in the account partition; removed when the browser drops it.

namespace ParishLife.Api.Models;

public class PushDevice
{
    public string Id { get; set; } = string.Empty;

    public string Endpoint { get; set; } = string.Empty;

    public string P256dh { get; set; } = string.Empty;

    public string Auth { get; set; } = string.Empty;

    public string? Label { get; set; } = null;

    public DateTimeOffset CreatedAt { get; set; }
}
