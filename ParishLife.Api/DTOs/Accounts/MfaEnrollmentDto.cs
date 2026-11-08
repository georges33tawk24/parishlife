// Purpose: returns the private enrollment secret and authenticator URI only during authenticated setup.
// Main members: EnrollmentId, SharedKey, AuthenticatorUri, ExpiresAt.

namespace ParishLife.Api.DTOs.Accounts;

public class MfaEnrollmentDto
{

    public string EnrollmentId { get; set; } = string.Empty;

    public string SharedKey { get; set; } = string.Empty;

    public string AuthenticatorUri { get; set; } = string.Empty;

    public DateTimeOffset ExpiresAt { get; set; }
}
