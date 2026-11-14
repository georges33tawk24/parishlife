// Purpose: a parish public profile as its editors see it: the draft, the published copy (if any), whether they differ, and the photographs.
// Main members: ParishId, Status (NotPublished, Published, PublishedWithChanges), Draft, Published, DraftUpdatedBy, DraftUpdatedAt,
// PublishedBy, PublishedAt and Photos.

namespace ParishLife.Api.DTOs.Publishing;

public class ParishProfileDto
{
    public string ParishId { get; set; } = string.Empty;

    public string Status { get; set; } = "NotPublished";

    public ParishProfileContentDto Draft { get; set; } = new();

    public ParishProfileContentDto? Published { get; set; } = null;

    public string? DraftUpdatedBy { get; set; } = null;

    public DateTimeOffset? DraftUpdatedAt { get; set; } = null;

    public string? PublishedBy { get; set; } = null;

    public DateTimeOffset? PublishedAt { get; set; } = null;

    public ParishProfilePhotoDto[] Photos { get; set; } = Array.Empty<ParishProfilePhotoDto>();
}
