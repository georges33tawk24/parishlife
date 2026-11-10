// Purpose: represents the priest-approved official numbering scheme for one sacrament register; no default scheme is assumed.
// Main members: Sacrament, Format, PerYear, ApprovalReference, ApprovedBy and ApprovedAt.

namespace ParishLife.Api.Models;

public class SacramentNumberingPolicy
{
    public string Sacrament { get; set; } = string.Empty;

    // Supplied by the competent authority; must contain {n} and may contain {year}.
    public string Format { get; set; } = string.Empty;

    // Restart numbering each calendar year of the celebration.
    public bool PerYear { get; set; }

    public string ApprovalReference { get; set; } = string.Empty;

    public string ApprovedBy { get; set; } = string.Empty;

    public DateTimeOffset ApprovedAt { get; set; }
}
