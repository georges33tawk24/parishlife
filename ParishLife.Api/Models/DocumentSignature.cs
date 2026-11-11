// Purpose: one immutable electronic authorization of an exact document version, sealed by the server and verifiable by its code.
// Main members: Code, document identity/version, the exact canonical Content and ContentHash, Seal, signer facts, the arrangement in force
// when signed, and append-only revocation facts.

namespace ParishLife.Api.Models;

public class DocumentSignature
{
    // Random 128-bit verification code (32 uppercase hex characters) printed on the document.
    public string Code { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    // Certificate or Letter.
    public string DocumentType { get; set; } = string.Empty;

    public string DocumentId { get; set; } = string.Empty;

    public string DocumentReference { get; set; } = string.Empty;

    public int DocumentVersion { get; set; }

    // The exact canonical fields that were authorized.
    public Dictionary<string, string> Content { get; set; } = new();

    public string ContentHash { get; set; } = string.Empty;

    // Data Protection seal over the code, document identity, content hash, signer and time.
    public string Seal { get; set; } = string.Empty;

    public string SignerAccountId { get; set; } = string.Empty;

    public string SignerName { get; set; } = string.Empty;

    // The verified authority used (currently always Parish priest).
    public string SignerAuthority { get; set; } = string.Empty;

    public string? ActingAppointmentId { get; set; } = null;

    public DateTimeOffset SignedAt { get; set; }

    // The approved arrangement reference in force at signing; null means reference only, not an official signature.
    public string? ArrangementReference { get; set; } = null;

    public string? RevokedBy { get; set; } = null;

    public DateTimeOffset? RevokedAt { get; set; } = null;

    // Internal; never returned publicly.
    public string? RevocationReason { get; set; } = null;
}
