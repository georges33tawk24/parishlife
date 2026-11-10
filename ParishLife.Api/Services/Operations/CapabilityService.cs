// Purpose: reports which integrations this deployment really has, so screens never offer or claim a delivery, payment, signature or deletion
// that does not happen. Only configuration that exists is read; nothing is probed or changed.
// Main function: List.

using ParishLife.Api.Configuration;
using ParishLife.Api.DTOs.Administration;

namespace ParishLife.Api.Services.Operations;

public class CapabilityService(IConfiguration configuration, StorageOptions storage)
{
    public IReadOnlyList<CapabilityDto> List()
    {
        var jobs = configuration.GetValue("BackgroundJobs:Enabled", false);
        var local = string.Equals(storage.Provider, "Local", StringComparison.OrdinalIgnoreCase);
        return
        [
            new() { Name = "Email delivery", Available = false, Behaviour = "Not configured: notifications are stored in-app only and never reported as emailed." },
            new() { Name = "SMS delivery", Available = false, Behaviour = "Not configured: no text messages are sent." },
            new() { Name = "Online payments", Available = false, Behaviour = "Not configured: staff record actual receipts manually; nothing is charged electronically." },
            new() { Name = "Electronic signatures", Available = false, Behaviour = "Not configured: the signed and sealed paper is the official document; downloads are copies." },
            new() { Name = "External sign-in", Available = false, Behaviour = "Not configured: accounts use ParishLife credentials with MFA." },
            new() { Name = "Bot check", Available = false, Behaviour = "Not configured: public forms rely on rate limiting and office review." },
            new() { Name = "Scheduled jobs", Available = jobs, Behaviour = jobs ? "Enabled for reservation holds, notifications and in-app scheduled report delivery; scheduled publishing is not implemented." : "Disabled in this environment." },
            new() { Name = "Private file storage", Available = true, Behaviour = local ? "Local development folder." : "Existing private evidence Blob container (needs the identity's data access)." },
            new() { Name = "Retention and deletion", Available = false, Behaviour = "No retention classes are approved: nothing is deleted automatically; closures remove only optional personal data." }
        ];
    }
}
