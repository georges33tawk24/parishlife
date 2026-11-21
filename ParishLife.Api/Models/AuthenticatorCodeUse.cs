// Purpose: remembers the authenticator codes accepted at sign-in for one account during the last five minutes, so no code can sign in
// twice while it is still within its validity window (attack vector 6, code replay). Stored beside the account document, never on it.
// Main members: Recent (one "unix-seconds:hash" entry per accepted code; the hash is SHA-256 of the account id and the code, never the
// code itself).

namespace ParishLife.Api.Models;

public class AuthenticatorCodeUse
{
    public List<string> Recent { get; set; } = [];
}
