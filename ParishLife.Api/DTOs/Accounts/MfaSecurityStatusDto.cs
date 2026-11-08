// Purpose: returns current MFA state and remaining recovery-code count without exposing secrets.
// Main members: Enabled, RecoveryCodesRemaining, PendingEnrollmentExpiresAt, RecoverySession.

namespace ParishLife.Api.DTOs.Accounts;

public class MfaSecurityStatusDto
{

    public bool Enabled { get; set; }

    public int RecoveryCodesRemaining { get; set; }

    public DateTimeOffset? PendingEnrollmentExpiresAt { get; set; }

    public bool RecoverySession { get; set; }
}
