// Purpose: settings for Web Push notifications to browsers and phones (VAPID, RFC 8292); no outside account is needed.
// Main members: PublicKey (base64url uncompressed P-256 point, given to browsers), PrivateKey (base64url P-256 scalar; private, App
// Service Key Vault reference only), Subject (a contact URL or mailto: the push services may use) and Configured.

namespace ParishLife.Api.Configuration;

public class WebPushOptions
{
    public string? PublicKey { get; set; }

    public string? PrivateKey { get; set; }

    public string Subject { get; set; } = "mailto:privacy@parish-life.org";

    public bool Configured => !string.IsNullOrWhiteSpace(PublicKey) && !string.IsNullOrWhiteSpace(PrivateKey);
}
