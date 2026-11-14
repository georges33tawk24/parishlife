// Purpose: shows the signed-in account one guest request it asked to link (A13), without the case contents.
// Main members: ParishId, ParishName, RequestId, Reference, ClaimedAt and State (Pending, Linked or NotPending).

namespace ParishLife.Api.DTOs.Requests;

public class RequestClaimDto
{
    public string ParishId { get; set; } = string.Empty;

    public string ParishName { get; set; } = string.Empty;

    public string RequestId { get; set; } = string.Empty;

    public string Reference { get; set; } = string.Empty;

    public DateTimeOffset ClaimedAt { get; set; }

    // Pending: waiting for office review. Linked: the case now belongs to this account. NotPending: declined, replaced or closed.
    public string State { get; set; } = string.Empty;
}
