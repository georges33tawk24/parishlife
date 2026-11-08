// Purpose: returns newly issued recovery codes once without persisting them in an operation receipt.
// Main members: Enabled, RecoveryCodes, RequiresSignIn.

namespace ParishLife.Api.DTOs.Accounts;

public class MfaRecoveryCodesDto
{

    public bool Enabled { get; set; }

    public string[] RecoveryCodes { get; set; } = Array.Empty<string>();

    public bool RequiresSignIn { get; set; }
}
