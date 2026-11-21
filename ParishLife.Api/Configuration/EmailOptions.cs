// Purpose: settings for sending ParishLife's account emails (sign-up confirmation and email-change codes) through Resend.
// Main members: Provider ("Resend" turns sending on), ResendApiKey (private; App Service Key Vault reference only, never appsettings.json),
// From (a verified parish-life.org sender, e.g. "ParishLife <no-reply@parish-life.org>"), Configured. Without all three nothing is sent
// and the capability endpoint keeps reporting NotConfigured.

namespace ParishLife.Api.Configuration;

public class EmailOptions
{
    public const string ResendProvider = "Resend";

    public string? Provider { get; set; }

    public string? ResendApiKey { get; set; }

    public string? From { get; set; }

    public bool Configured => string.Equals(Provider, ResendProvider, StringComparison.OrdinalIgnoreCase)
        && !string.IsNullOrWhiteSpace(ResendApiKey) && !string.IsNullOrWhiteSpace(From);
}
