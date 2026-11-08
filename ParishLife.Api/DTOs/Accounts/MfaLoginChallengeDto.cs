// Purpose: returns the opaque MFA challenge and expiry without granting a session.
// Main members: AccountId, Challenge, ExpiresAt.

namespace ParishLife.Api.DTOs.Accounts;

public class MfaLoginChallengeDto
{
    public string AccountId { get; set; } = string.Empty;

    public string Challenge { get; set; } = string.Empty;

    public DateTimeOffset ExpiresAt { get; set; }
}
