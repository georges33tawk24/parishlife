// Purpose: the safe operator view of one sign-in account; it never carries password hashes, security stamps, authenticator keys,
// recovery codes, passkeys, external logins or verification evidence.
// Main members: AccountId, UserName, DisplayName, Email, EmailConfirmed, IdentityVerified, TwoFactorEnabled, PlatformOperator, Status and CreatedAt.

namespace ParishLife.Api.DTOs.Administration;

public class PlatformAccountDto
{
    public string AccountId { get; set; } = string.Empty;

    public string UserName { get; set; } = string.Empty;

    public string DisplayName { get; set; } = string.Empty;

    public string? Email { get; set; } = null;

    public bool EmailConfirmed { get; set; }

    public bool IdentityVerified { get; set; }

    public bool TwoFactorEnabled { get; set; }

    public bool PlatformOperator { get; set; }

    // Active, Suspended or Pending (registration not finished).
    public string Status { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }
}
