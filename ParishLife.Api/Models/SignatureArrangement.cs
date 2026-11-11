// Purpose: records whether the competent authority (the jurisdiction bishop) has approved an electronic-signature arrangement for its parishes.
// Main members: ArchdioceseId, Approved, ApprovalReference, Reason, RecordedBy and RecordedAt; an absent record means not approved.

namespace ParishLife.Api.Models;

public class SignatureArrangement
{
    public string ArchdioceseId { get; set; } = string.Empty;

    public bool Approved { get; set; }

    // The authority's own decision reference; required when Approved.
    public string? ApprovalReference { get; set; } = null;

    public string Reason { get; set; } = string.Empty;

    public string RecordedBy { get; set; } = string.Empty;

    public DateTimeOffset RecordedAt { get; set; }
}
