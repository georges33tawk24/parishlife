// Purpose: returns the archdiocese's recorded electronic-signature arrangement; Approved is false when nothing was recorded.
// Main members: Approved, ApprovalReference, Reason, RecordedBy and RecordedAt.

namespace ParishLife.Api.DTOs.Documents;

public class SignatureArrangementStateDto
{
    public bool Approved { get; set; }

    public string? ApprovalReference { get; set; } = null;

    public string? Reason { get; set; } = null;

    public string? RecordedBy { get; set; } = null;

    public DateTimeOffset? RecordedAt { get; set; } = null;
}
