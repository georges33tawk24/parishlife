// Purpose: returns the caller's own signer setup.
// Main members: PrintedName, UpdatedAt and Version (the current version a replacement must send).

namespace ParishLife.Api.DTOs.Documents;

public class SignerProfileDto
{
    public string PrintedName { get; set; } = string.Empty;

    public string Version { get; set; } = string.Empty;

    public DateTimeOffset UpdatedAt { get; set; }
}
