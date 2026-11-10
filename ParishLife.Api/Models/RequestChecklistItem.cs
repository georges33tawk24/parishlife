// Purpose: represents one required or optional item of a request's paper/evidence checklist.
// Main members: Key, Label, Required, Status, PaperReference, VerifiedBy and VerifiedAt.

namespace ParishLife.Api.Models;

public class RequestChecklistItem
{
    public string Key { get; set; } = string.Empty;

    public string Label { get; set; } = string.Empty;

    public bool Required { get; set; }

    // Missing, Received or NotApplicable.
    public string Status { get; set; } = "Missing";

    public string? PaperReference { get; set; } = null;

    public string? VerifiedBy { get; set; } = null;

    public DateTimeOffset? VerifiedAt { get; set; } = null;
}
