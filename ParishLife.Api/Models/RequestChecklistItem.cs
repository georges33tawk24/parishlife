// Purpose: represents one required or optional item of a request's paper/evidence checklist.
// Main members: Key, Label, Required, Status, PaperReference, EvidenceFileId, VerifiedBy and VerifiedAt.

namespace ParishLife.Api.Models;

public class RequestChecklistItem
{
    public string Key { get; set; } = string.Empty;

    public string Label { get; set; } = string.Empty;

    public bool Required { get; set; }

    // Missing, Received or NotApplicable.
    public string Status { get; set; } = "Missing";

    public string? PaperReference { get; set; } = null;

    // An active private evidence file of the same case that the office accepted for this item (instead of, or as well as, a paper reference).
    public string? EvidenceFileId { get; set; } = null;

    public string? VerifiedBy { get; set; } = null;

    public DateTimeOffset? VerifiedAt { get; set; } = null;
}
