// Purpose: returns WebAuthn options JSON plus an opaque, protected, short-lived ceremony state.
// Main members: State (send back unchanged), OptionsJson (pass to the browser WebAuthn JSON parser), ExpiresAt.

namespace ParishLife.Api.DTOs.Accounts;

public class PasskeyCeremonyDto
{
    public string State { get; set; } = string.Empty;

    public string OptionsJson { get; set; } = string.Empty;

    public DateTimeOffset ExpiresAt { get; set; }
}
