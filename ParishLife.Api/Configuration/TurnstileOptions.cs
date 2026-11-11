// Purpose: optional Cloudflare Turnstile settings; enforcement starts only when both keys are configured (disabled by default).
// Main members: SiteKey (public), SecretKey (private; supply through App Service/Key Vault reference, never appsettings),
// ExpectedHostname (optional), VerifyEndpoint, Enabled.

namespace ParishLife.Api.Configuration;

public class TurnstileOptions
{
    public string? SiteKey { get; set; }

    public string? SecretKey { get; set; }

    public string? ExpectedHostname { get; set; }

    public string VerifyEndpoint { get; set; } = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

    public bool Enabled => !string.IsNullOrWhiteSpace(SiteKey) && !string.IsNullOrWhiteSpace(SecretKey);
}
