// Purpose: represents a uniquely referenced counting session from opening through independent verification to a single posting.
// Main members: Id, ParishId, Reference, Source, CollectedOn, Status, Lines, Revision, editors, verification, variance and posting facts.

namespace ParishLife.Api.Models;

public class CountSession
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string Reference { get; set; } = string.Empty;

    public string Source { get; set; } = string.Empty;

    public DateOnly CollectedOn { get; set; }

    // Open, Variance, Verified or Posted.
    public string Status { get; set; } = "Open";

    public GiftLine[] Lines { get; set; } = Array.Empty<GiftLine>();

    public int Revision { get; set; }

    // Everyone who opened or edited lines; none of them may verify.
    public string[] EditorAccountIds { get; set; } = Array.Empty<string>();

    public string? VerifiedBy { get; set; } = null;

    public int? VerifiedRevision { get; set; } = null;

    // The verifier's differing observation, kept as recorded.
    public CurrencyTotal[] VarianceObserved { get; set; } = Array.Empty<CurrencyTotal>();

    public string? VarianceNote { get; set; } = null;

    public string? PostedBy { get; set; } = null;

    public DateTimeOffset? PostedAt { get; set; } = null;

    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }
}
