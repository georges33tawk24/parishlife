// Purpose: reports whether Turnstile bot verification is enforced and the public site key a client needs.
// Main members: Enabled, SiteKey (public; the secret key is never exposed), Header.

namespace ParishLife.Api.DTOs.Accounts;

public class TurnstileCapabilityDto
{
    public bool Enabled { get; set; }

    public string? SiteKey { get; set; }

    public string Header { get; set; } = "X-Turnstile-Token";
}
