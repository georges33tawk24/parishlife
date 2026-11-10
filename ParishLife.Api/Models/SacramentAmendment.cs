// Purpose: represents one approved correction appended to a registered entry; the original value is kept.
// Main members: CorrectionId, Field, OldValue, NewValue, Reason, Evidence, ProposedBy, ApprovedBy and ApprovedAt.

namespace ParishLife.Api.Models;

public class SacramentAmendment
{
    public string CorrectionId { get; set; } = string.Empty;

    public string Field { get; set; } = string.Empty;

    public string? OldValue { get; set; } = null;

    public string NewValue { get; set; } = string.Empty;

    public string Reason { get; set; } = string.Empty;

    public string Evidence { get; set; } = string.Empty;

    public string ProposedBy { get; set; } = string.Empty;

    public string ApprovedBy { get; set; } = string.Empty;

    public DateTimeOffset ApprovedAt { get; set; }
}
