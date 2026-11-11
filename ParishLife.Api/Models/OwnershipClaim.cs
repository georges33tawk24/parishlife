// Purpose: a restricted claim that a parish's controlling administration belongs to someone else, reviewed by a platform recovery operator.
// Recovery moves only the controlling owner and owner grant; prior grants are revoked, never deleted, and all parish records stay.
// Main members: Id, ParishId, ClaimantAccountId, OwnerAtOpening, Statement, EvidenceReference, Status, owner response, decision and reconciliation.

namespace ParishLife.Api.Models;

public class OwnershipClaim
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string ClaimantAccountId { get; set; } = string.Empty;

    public string OwnerAtOpening { get; set; } = string.Empty;

    public string Statement { get; set; } = string.Empty;

    public string EvidenceReference { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public DateTimeOffset OpenedAt { get; set; }

    public string? OwnerResponse { get; set; }

    public DateTimeOffset? OwnerRespondedAt { get; set; }

    public string? DecidedBy { get; set; }

    public DateTimeOffset? DecidedAt { get; set; }

    public string? DecisionReason { get; set; }

    public string? ReviewEvidenceReference { get; set; }

    public string? PreviousOwnerAccountId { get; set; }

    public string[] ReconciledRecords { get; set; } = Array.Empty<string>();
}
