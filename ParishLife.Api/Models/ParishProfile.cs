// Purpose: a parish's public profile record: the draft its editors work on and, separately, the copy they explicitly published. Visitors only
// ever see the published copy; saving a draft never changes it, and unpublishing removes it without touching the draft.
// Main members: ParishId, Draft, Published, DraftUpdatedBy, DraftUpdatedAt, PublishedBy and PublishedAt.

namespace ParishLife.Api.Models;

public class ParishProfile
{
    public string ParishId { get; set; } = string.Empty;

    public ParishProfileContent Draft { get; set; } = new();

    // Null until the parish publishes, and again after it unpublishes.
    public ParishProfileContent? Published { get; set; } = null;

    public string DraftUpdatedBy { get; set; } = string.Empty;

    public DateTimeOffset DraftUpdatedAt { get; set; }

    public string? PublishedBy { get; set; } = null;

    public DateTimeOffset? PublishedAt { get; set; } = null;
}
