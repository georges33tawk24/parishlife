// Purpose: one office letter answering a request case (X04): drafted by the office, signed exactly by a parish document signer,
// released to a verified recipient, and withdrawn or replaced by a new version without overwriting what was signed or released.
// Main members: request link, reference/version/replacement, text, addressee, status, signature code and release/withdrawal facts.

namespace ParishLife.Api.Models;

public class RequestLetter
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string RequestId { get; set; } = string.Empty;

    public string Reference { get; set; } = string.Empty;

    // 1 for a first letter; each replacement increases it.
    public int Version { get; set; }

    public string? ReplacesId { get; set; } = null;

    public string? ReplaceReason { get; set; } = null;

    // Set when a replacement is signed.
    public string? SupersededById { get; set; } = null;

    public string Title { get; set; } = string.Empty;

    public string Body { get; set; } = string.Empty;

    public string Language { get; set; } = "en";

    public string AddresseeName { get; set; } = string.Empty;

    // Draft, Signed, Released or Withdrawn.
    public string Status { get; set; } = "Draft";

    public string DraftedBy { get; set; } = string.Empty;

    public DateTimeOffset DraftedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    public string? SignatureCode { get; set; } = null;

    public string? SignedBy { get; set; } = null;

    public DateTimeOffset? SignedAt { get; set; } = null;

    public string? ReleasedBy { get; set; } = null;

    public DateTimeOffset? ReleasedAt { get; set; } = null;

    // InPerson or VerifiedAccount.
    public string? ReleaseMethod { get; set; } = null;

    // Office-only note of how the recipient was checked.
    public string? ReleaseEvidence { get; set; } = null;

    public string? WithdrawnBy { get; set; } = null;

    public DateTimeOffset? WithdrawnAt { get; set; } = null;

    public string? WithdrawalReason { get; set; } = null;

    public List<string>? NotificationWorkIds { get; set; } = null;
}
