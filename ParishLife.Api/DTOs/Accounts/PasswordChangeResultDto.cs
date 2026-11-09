// Purpose: reports an actual password-change outcome without credentials, hashes, security stamps or fabricated notification delivery.
// Main members: OperationId, Status, ChangedAt, RequestedPasswordIsCurrent, PriorSessionsInvalidated and RequiresSignIn.

namespace ParishLife.Api.DTOs.Accounts;

public class PasswordChangeResultDto
{
    public string OperationId { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public DateTimeOffset ChangedAt { get; set; }

    public bool RequestedPasswordIsCurrent { get; set; }

    public bool PriorSessionsInvalidated { get; set; }

    public bool RequiresSignIn { get; set; }
}
