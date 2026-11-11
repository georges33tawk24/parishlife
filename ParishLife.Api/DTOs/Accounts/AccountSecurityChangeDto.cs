// Purpose: reports the committed outcome of a sign-in-method change without credentials or security stamps.
// Main members: OperationId, Status (Applied or AlreadyApplied), ResourceId and RequiresSignIn.

namespace ParishLife.Api.DTOs.Accounts;

public class AccountSecurityChangeDto
{
    public string OperationId { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public string ResourceId { get; set; } = string.Empty;

    public bool RequiresSignIn { get; set; }
}
