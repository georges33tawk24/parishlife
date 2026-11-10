// Purpose: returns a counting session with its lines and totals by currency and method.
// Main members: Id, Reference, Source, CollectedOn, Status, Revision, Lines, Totals, VerifiedBy, VerifiedRevision, VarianceObserved, VarianceNote, PostedBy and PostedAt.

namespace ParishLife.Api.DTOs.Finance;

public class CountSessionDto
{
    public string Id { get; set; } = string.Empty;

    public string Reference { get; set; } = string.Empty;

    public string Source { get; set; } = string.Empty;

    public DateOnly CollectedOn { get; set; }

    public string Status { get; set; } = string.Empty;

    public int Revision { get; set; }

    public GiftLineDto[] Lines { get; set; } = Array.Empty<GiftLineDto>();

    public CurrencyTotalDto[] Totals { get; set; } = Array.Empty<CurrencyTotalDto>();

    public string? VerifiedBy { get; set; } = null;

    public int? VerifiedRevision { get; set; } = null;

    public CurrencyTotalDto[] VarianceObserved { get; set; } = Array.Empty<CurrencyTotalDto>();

    public string? VarianceNote { get; set; } = null;

    public string? PostedBy { get; set; } = null;

    public DateTimeOffset? PostedAt { get; set; } = null;
}
