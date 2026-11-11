// Purpose: records an external identity-provider subject explicitly linked by an authenticated MFA account holder.
// Main members: Provider, SubjectHash (SHA-256 of the provider subject; the raw subject is not stored), LinkedAt.

namespace ParishLife.Api.Models;

public class AccountExternalLogin
{
    public string Provider { get; set; } = string.Empty;

    public string SubjectHash { get; set; } = string.Empty;

    public DateTimeOffset LinkedAt { get; set; }
}
