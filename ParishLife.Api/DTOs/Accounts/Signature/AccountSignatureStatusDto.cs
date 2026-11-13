// Purpose: answers My account's signature panel: whether this sign-in may keep a signature image and the one stored, if any.
// Main members: Eligible, Version (null when nothing is stored; send it back to replace or remove) and Signature.

namespace ParishLife.Api.DTOs.Accounts.Signature;

public class AccountSignatureStatusDto
{
    public bool Eligible { get; set; }

    public string? Version { get; set; } = null;

    public AccountSignatureDto? Signature { get; set; } = null;
}
