// Purpose: represents one certificate/extract from a registered sacramental entry through preparation, priest signing, optional bishop acceptance, issue and release.
// Main members: identity/source/request, issued snapshot, signature/release gates and the latest tracked required-notification batch.

namespace ParishLife.Api.Models;

public class Certificate
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string Reference { get; set; } = string.Empty;

    // 1 for a first issuance; reissues increase it.
    public int Version { get; set; }

    public string? ReplacesId { get; set; } = null;

    public string? ReissueReason { get; set; } = null;

    public string PersonId { get; set; } = string.Empty;

    // The sacrament.
    public string Kind { get; set; } = string.Empty;

    public string? SourceRecordId { get; set; } = null;

    public string? RequestId { get; set; } = null;

    public string Language { get; set; } = "en";

    public int Quantity { get; set; }

    public string? Purpose { get; set; } = null;

    // WaitingForSource, Received, Prepared, AwaitingSignature, AwaitingBishop, AuthorizedForIssuance, Issued, Released, Returned, Withdrawn or Cancelled.
    public string Status { get; set; } = "Received";

    // The source entry's current facts frozen at preparation.
    public Dictionary<string, string> Snapshot { get; set; } = new();

    public string? OfficialNumber { get; set; } = null;

    public int SourceAmendments { get; set; }

    public bool BishopReviewRequired { get; set; }

    public string? PreparedBy { get; set; } = null;

    public string? SignedBy { get; set; } = null;

    public DateTimeOffset? SignedAt { get; set; } = null;

    public string? AcceptedBy { get; set; } = null;

    public DateTimeOffset? AcceptedAt { get; set; } = null;

    // Restricted to office and clergy.
    public string? ReturnReason { get; set; } = null;

    public string? IssuedBy { get; set; } = null;

    public DateTimeOffset? IssuedAt { get; set; } = null;

    public string? ReleasedBy { get; set; } = null;

    public DateTimeOffset? ReleasedAt { get; set; } = null;

    public string? RecipientName { get; set; } = null;

    public string? RecipientRelationship { get; set; } = null;

    public string? VerificationMethod { get; set; } = null;

    public string? VerificationEvidence { get; set; } = null;

    public string? WithdrawalReason { get; set; } = null;

    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    // Null preserves legacy uncertainty; an empty list records that no validated account notice was required for the tracked transition.
    public List<string>? NotificationWorkIds { get; set; } = null;
}
