// Purpose: returns one electronic authorization to authorized parish staff, with its current derived status and integrity result.
// Main members: Code, document identity, ContentHash, Content, signer facts, ArrangementReference, Status, IntegrityVerified and revocation facts.

namespace ParishLife.Api.DTOs.Documents;

public class DocumentSignatureDto
{
    public string Code { get; set; } = string.Empty;

    public string DocumentType { get; set; } = string.Empty;

    public string DocumentId { get; set; } = string.Empty;

    public string DocumentReference { get; set; } = string.Empty;

    public int DocumentVersion { get; set; }

    public Dictionary<string, string> Content { get; set; } = new();

    public string ContentHash { get; set; } = string.Empty;

    public string SignerAccountId { get; set; } = string.Empty;

    public string SignerName { get; set; } = string.Empty;

    public string SignerAuthority { get; set; } = string.Empty;

    public DateTimeOffset SignedAt { get; set; }

    public string? ArrangementReference { get; set; } = null;

    // Valid, NotYetIssued, Superseded, Invalidated, Withdrawn, Revoked or IntegrityCheckFailed.
    public string Status { get; set; } = string.Empty;

    public bool IntegrityVerified { get; set; }

    public string? RevokedBy { get; set; } = null;

    public DateTimeOffset? RevokedAt { get; set; } = null;

    public string? RevocationReason { get; set; } = null;
}
