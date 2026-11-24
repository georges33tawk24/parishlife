// Purpose: reports which integrations this deployment really has, so screens never offer or claim a delivery, payment, signature or deletion
// that does not happen. Only configuration that exists is read (email, push, WhatsApp, external sign-in, bot check, scheduled jobs); nothing is
// probed or changed.
// Main function: List. External sign-in, the bot check and account email follow the same configuration checks that register them
// (ServiceCollectionExtensions.RegisterAuthenticationCapabilities), so the report cannot drift from what is live.

using ParishLife.Api.Configuration;
using ParishLife.Api.DTOs.Administration;

namespace ParishLife.Api.Services.Operations;

public class CapabilityService(IConfiguration configuration, StorageOptions storage)
{
    public IReadOnlyList<CapabilityDto> List()
    {
        var jobs = configuration.GetValue("BackgroundJobs:Enabled", false);
        var local = string.Equals(storage.Provider, "Local", StringComparison.OrdinalIgnoreCase);
        var email = configuration.GetSection("Email").Get<EmailOptions>()?.Configured == true;
        var push = configuration.GetSection("WebPush").Get<WebPushOptions>()?.Configured == true;
        var whatsApp = configuration.GetSection("WhatsApp").Get<WhatsAppOptions>()?.Configured == true;
        var providers = ExternalProviderOptions.Providers.Keys
            .Where(p => configuration.GetSection("ExternalSignIn:" + p).Get<ExternalProviderOptions>()?.IsConfigured(p) == true).ToArray();
        var turnstile = configuration.GetSection("Turnstile").Get<TurnstileOptions>()?.Enabled == true;
        return
        [
            new() { Name = "Email delivery", Available = email, Behaviour = email
                ? "Resend sends account codes, and copies of notices and broadcasts to people who keep email on (confirmed addresses only)."
                : "Not configured: notifications are stored in-app only and never reported as emailed." },
            new() { Name = "Push notifications", Available = push, Behaviour = push ? "Web push to devices people turned on." : "Not configured." },
            new() { Name = "WhatsApp delivery", Available = whatsApp, Behaviour = whatsApp ? "Approved templates to numbers people proved." : "Not configured." },
            new() { Name = "SMS delivery", Available = false, Behaviour = "Not offered (owner decision): no text messages are sent." },
            new() { Name = "Online payments", Available = false, Behaviour = "Not offered (owner decision): staff record actual receipts manually; nothing is charged electronically." },
            new() { Name = "Electronic signatures", Available = false, Behaviour = "The signed and sealed paper is the official document (owner decision); downloads are copies." },
            new() { Name = "External sign-in", Available = providers.Length > 0, Behaviour = providers.Length > 0
                ? "Sign-in and sign-up with " + string.Join(" and ", providers) + "; an authenticator is still asked for where an account has one."
                : "Not configured: accounts use ParishLife credentials with MFA." },
            new() { Name = "Bot check", Available = turnstile, Behaviour = turnstile
                ? "Cloudflare Turnstile on sign-in, sign-up, passkey sign-in, email codes, password reset and public request forms."
                : "Not configured: public forms rely on rate limiting and office review." },
            new() { Name = "Scheduled jobs", Available = jobs, Behaviour = jobs ? "Enabled for reservation holds, notifications, outside delivery, retention and in-app scheduled report delivery; scheduled publishing is not implemented." : "Disabled in this environment." },
            new() { Name = "Private file storage", Available = true, Behaviour = local ? "Local development folder." : "Existing private evidence Blob container (needs the identity's data access)." },
            new() { Name = "Retention and deletion", Available = jobs, Behaviour = jobs
                ? "Notices read more than a year ago and anonymous site counts older than two years are deleted automatically (owner decision, 23 November 2026); parish records and audit are kept; closures remove only optional personal data."
                : "Scheduled jobs are off here, so nothing is deleted automatically; parish records and audit are kept; closures remove only optional personal data." }
        ];
    }
}
