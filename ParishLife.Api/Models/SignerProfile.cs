// Purpose: holds how one account's name is printed when it electronically authorizes a document (X03 signer setup).
// Main members: AccountId, PrintedName and UpdatedAt; signatures copy the name, so later changes never alter an earlier authorization.

namespace ParishLife.Api.Models;

public class SignerProfile
{
    public string AccountId { get; set; } = string.Empty;

    public string PrintedName { get; set; } = string.Empty;

    public DateTimeOffset UpdatedAt { get; set; }
}
