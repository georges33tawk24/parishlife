// Purpose: returns the caller's own signer setup.
// Main members: PrintedName and UpdatedAt.

namespace ParishLife.Api.DTOs.Documents;

public class SignerProfileDto
{
    public string PrintedName { get; set; } = string.Empty;

    public DateTimeOffset UpdatedAt { get; set; }
}
