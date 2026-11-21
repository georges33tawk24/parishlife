// Purpose: the outcome of closing an account: what was removed and what parishes keep under their own retention.
// Main members: OperationId, Status (Closed or AlreadyApplied), ClosedAt, Removed, Kept.

namespace ParishLife.Api.DTOs.Accounts;

public class AccountClosureDto
{
    public string OperationId { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public DateTimeOffset ClosedAt { get; set; }

    public string[] Removed { get; set; } = [];

    public string[] Kept { get; set; } = [];
}
