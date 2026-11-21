// Purpose: optional Cloudflare Turnstile settings; enforcement starts only when both keys are configured (disabled by default).
// Main members: SiteKey (public), SecretKey (private; supply through App Service/Key Vault reference, never appsettings),
// ExpectedHostname (optional), VerifyEndpoint, Enabled, ConfigurationProblem (startup check: one key without the other, or an
// unresolved Key Vault reference, would otherwise switch the bot check off or break sign-in silently).

namespace ParishLife.Api.Configuration;

public class TurnstileOptions
{
    public string? SiteKey { get; set; }

    public string? SecretKey { get; set; }

    public string? ExpectedHostname { get; set; }

    public string VerifyEndpoint { get; set; } = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

    public bool Enabled => !string.IsNullOrWhiteSpace(SiteKey) && !string.IsNullOrWhiteSpace(SecretKey);

    // Null when Turnstile is fully configured or fully off; otherwise a message naming the setting (never its value).
    public string? ConfigurationProblem()
    {
        if (string.IsNullOrWhiteSpace(SiteKey) != string.IsNullOrWhiteSpace(SecretKey))
            return "Turnstile needs both Turnstile:SiteKey and Turnstile:SecretKey, or neither; only one is set.";
        if (AzureConfiguration.IsUnresolvedKeyVaultReference(SecretKey))
            return "Turnstile:SecretKey is an unresolved Key Vault reference; check the App Service identity's access to the secret.";
        return null;
    }
}
