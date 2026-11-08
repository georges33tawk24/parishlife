// Purpose: stores an expiring staged authenticator without changing the active device before proof.
// Main members: Id, AccountId, SecurityStampAtStart, ProtectedAuthenticatorKey, CreatedAt, ExpiresAt, RecoveryRequestId and related state.

namespace ParishLife.Api.Models;

public class MfaEnrollment
{

    public string Id { get; set; } = string.Empty;

    public string AccountId { get; set; } = string.Empty;

    public string SecurityStampAtStart { get; set; } = string.Empty;

    public string ProtectedAuthenticatorKey { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset ExpiresAt { get; set; }

    public string? RecoveryRequestId { get; set; }

    public string Status { get; set; } = "Pending";
}
