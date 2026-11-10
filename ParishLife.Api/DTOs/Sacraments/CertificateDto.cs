// Purpose: returns a certificate with its source snapshot, gates, release record and a plain statement of what the digital copy is.
// Main members: identity/source/request, prepared snapshot, gate/release facts, electronic authorization code, replacement, CopyStatement and safe notification outcome.

using ParishLife.Api.DTOs.Communications;

namespace ParishLife.Api.DTOs.Sacraments;

public class CertificateDto
{
    public string Id { get; set; } = string.Empty;

    public string Reference { get; set; } = string.Empty;

    public int Version { get; set; }

    public string? ReplacesId { get; set; } = null;

    public string SubjectPersonId { get; set; } = string.Empty;

    public string Sacrament { get; set; } = string.Empty;

    public string? SourceRecordId { get; set; } = null;

    public string? RequestId { get; set; } = null;

    public string Language { get; set; } = string.Empty;

    public int Quantity { get; set; }

    public string? Purpose { get; set; } = null;

    public string Status { get; set; } = string.Empty;

    public Dictionary<string, string> Snapshot { get; set; } = new();

    public string? OfficialNumber { get; set; } = null;

    public bool BishopReviewRequired { get; set; }

    public string? PreparedBy { get; set; } = null;

    public string? SignedBy { get; set; } = null;

    public DateTimeOffset? SignedAt { get; set; } = null;

    public string? AcceptedBy { get; set; } = null;

    public DateTimeOffset? AcceptedAt { get; set; } = null;

    public string? ReturnReason { get; set; } = null;

    public string? IssuedBy { get; set; } = null;

    public DateTimeOffset? IssuedAt { get; set; } = null;

    public string? ReleasedBy { get; set; } = null;

    public DateTimeOffset? ReleasedAt { get; set; } = null;

    public string? RecipientName { get; set; } = null;

    public string? RecipientRelationship { get; set; } = null;

    public string? VerificationMethod { get; set; } = null;

    public string? WithdrawalReason { get; set; } = null;

    public string? AuthorizationCode { get; set; } = null;

    public List<string> AuthorizationCodes { get; set; } = new();

    public string? SupersededById { get; set; } = null;

    public string CopyStatement { get; set; } = "Digital copy for reference only; the wet-signed and sealed paper issued by the parish is the official document.";

    // Loaded only after certificate command/read authorization; list views leave this null.
    public NotificationOutcomeDto? NotificationOutcome { get; set; } = null;
}
