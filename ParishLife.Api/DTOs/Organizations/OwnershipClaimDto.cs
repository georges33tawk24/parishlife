// Purpose: role-limited view of an ownership claim. The reviewer sees everything; the claimant sees its own submission and the outcome;
// the current owner sees only that a claim exists, its status and its own response (no claimant identity, statement or evidence).
// Main members: claim fields (null when the viewer may not see them); ForReviewer, ForClaimant and ForOwner build each projection.

using ParishLife.Api.Models;

namespace ParishLife.Api.DTOs.Organizations;

public class OwnershipClaimDto
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public DateTimeOffset OpenedAt { get; set; }

    public DateTimeOffset? DecidedAt { get; set; }

    public string? ClaimantAccountId { get; set; }

    public string? Statement { get; set; }

    public string? EvidenceReference { get; set; }

    public string? OwnerAtOpening { get; set; }

    public string? OwnerResponse { get; set; }

    public DateTimeOffset? OwnerRespondedAt { get; set; }

    public string? DecidedBy { get; set; }

    public string? DecisionReason { get; set; }

    public string? ReviewEvidenceReference { get; set; }

    public string? PreviousOwnerAccountId { get; set; }

    public string[] ReconciledRecords { get; set; } = Array.Empty<string>();

    public static OwnershipClaimDto ForReviewer(OwnershipClaim c) => new()
    {
        Id = c.Id, ParishId = c.ParishId, Status = c.Status, OpenedAt = c.OpenedAt, DecidedAt = c.DecidedAt, ClaimantAccountId = c.ClaimantAccountId,
        Statement = c.Statement, EvidenceReference = c.EvidenceReference, OwnerAtOpening = c.OwnerAtOpening, OwnerResponse = c.OwnerResponse,
        OwnerRespondedAt = c.OwnerRespondedAt, DecidedBy = c.DecidedBy, DecisionReason = c.DecisionReason, ReviewEvidenceReference = c.ReviewEvidenceReference,
        PreviousOwnerAccountId = c.PreviousOwnerAccountId, ReconciledRecords = [.. c.ReconciledRecords]
    };

    public static OwnershipClaimDto ForClaimant(OwnershipClaim c) => new()
    {
        Id = c.Id, ParishId = c.ParishId, Status = c.Status, OpenedAt = c.OpenedAt, DecidedAt = c.DecidedAt, ClaimantAccountId = c.ClaimantAccountId,
        Statement = c.Statement, EvidenceReference = c.EvidenceReference, DecisionReason = c.DecisionReason
    };

    public static OwnershipClaimDto ForOwner(OwnershipClaim c) => new()
    {
        Id = c.Id, ParishId = c.ParishId, Status = c.Status, OpenedAt = c.OpenedAt, DecidedAt = c.DecidedAt,
        OwnerResponse = c.OwnerResponse, OwnerRespondedAt = c.OwnerRespondedAt
    };
}
