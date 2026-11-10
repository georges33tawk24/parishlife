// Purpose: returns one request letter to authorized parish staff with its drafting, signature, release and withdrawal facts.
// Main members: identity/request/version/replacement, text, addressee, Status, SignatureCode, signer, release and withdrawal facts.

namespace ParishLife.Api.DTOs.Documents;

public class LetterDto
{
    public string Id { get; set; } = string.Empty;

    public string RequestId { get; set; } = string.Empty;

    public string Reference { get; set; } = string.Empty;

    public int Version { get; set; }

    public string? ReplacesId { get; set; } = null;

    public string? ReplaceReason { get; set; } = null;

    public string? SupersededById { get; set; } = null;

    public string Title { get; set; } = string.Empty;

    public string Body { get; set; } = string.Empty;

    public string Language { get; set; } = string.Empty;

    public string AddresseeName { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public string DraftedBy { get; set; } = string.Empty;

    public DateTimeOffset DraftedAt { get; set; }

    public string? SignatureCode { get; set; } = null;

    public string? SignedBy { get; set; } = null;

    public DateTimeOffset? SignedAt { get; set; } = null;

    public string? ReleasedBy { get; set; } = null;

    public DateTimeOffset? ReleasedAt { get; set; } = null;

    public string? ReleaseMethod { get; set; } = null;

    public string? ReleaseEvidence { get; set; } = null;

    public string? WithdrawnBy { get; set; } = null;

    public DateTimeOffset? WithdrawnAt { get; set; } = null;

    public string? WithdrawalReason { get; set; } = null;
}
