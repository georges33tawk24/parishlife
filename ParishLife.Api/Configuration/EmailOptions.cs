// Purpose: settings for sending ParishLife's account emails (sign-up confirmation and email-change codes) through Resend.
// Main members: Provider ("Resend" turns sending on), ResendApiKey (private; App Service Key Vault reference only, never appsettings.json),
// From (a verified parish-life.org sender, e.g. "ParishLife <no-reply@parish-life.org>"), Configured. Without all three nothing is sent
// and the capability endpoint keeps reporting NotConfigured. ConfigurationProblem is the startup check for a half-set or unknown
// provider and an unresolved Key Vault reference.

namespace ParishLife.Api.Configuration;

public class EmailOptions
{
    public const string ResendProvider = "Resend";

    public string? Provider { get; set; }

    public string? ResendApiKey { get; set; }

    public string? From { get; set; }

    public bool Configured => string.Equals(Provider, ResendProvider, StringComparison.OrdinalIgnoreCase)
        && !string.IsNullOrWhiteSpace(ResendApiKey) && !string.IsNullOrWhiteSpace(From);

    // Null when email is fully configured or fully off; otherwise a message naming the setting (never its value).
    public string? ConfigurationProblem()
    {
        var anySet = !string.IsNullOrWhiteSpace(Provider) || !string.IsNullOrWhiteSpace(ResendApiKey) || !string.IsNullOrWhiteSpace(From);
        if (!anySet)
            return null;
        if (!string.Equals(Provider, ResendProvider, StringComparison.OrdinalIgnoreCase))
            return "Email:Provider must be \"Resend\" when any Email setting is present.";
        if (string.IsNullOrWhiteSpace(ResendApiKey) || string.IsNullOrWhiteSpace(From))
            return "Email:Provider is Resend, so Email:ResendApiKey and Email:From are both required.";
        if (AzureConfiguration.IsUnresolvedKeyVaultReference(ResendApiKey))
            return "Email:ResendApiKey is an unresolved Key Vault reference; check the App Service identity's access to the secret.";
        return null;
    }
}
