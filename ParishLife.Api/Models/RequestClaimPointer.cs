// Purpose: an account-partition pointer to a guest request this account asked to link, so the account can list its claims.
// It is written before the parish claim commits; an orphan pointer only ever resolves to NotPending.
// Main members: Id, AccountId, ParishId, RequestId, Reference and ClaimedAt.

namespace ParishLife.Api.Models;

public class RequestClaimPointer
{
    public string Id { get; set; } = string.Empty;

    public string AccountId { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string RequestId { get; set; } = string.Empty;

    public string Reference { get; set; } = string.Empty;

    public DateTimeOffset ClaimedAt { get; set; }
}
