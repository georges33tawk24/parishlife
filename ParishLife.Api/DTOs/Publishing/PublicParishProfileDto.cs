// Purpose: what visitors see of a parish profile: only the copy the parish explicitly published, its published photographs and, when the
// parish chose to list them, its currently appointed priests. Drafts, private photos, editor identities and the private registration contact
// are never included.
// Main members: ParishId, Name, Locality, Profile, Photos, Clergy, CalendarFeed and PublishedAt.

namespace ParishLife.Api.DTOs.Publishing;

public class PublicParishProfileDto
{
    public string ParishId { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string Locality { get; set; } = string.Empty;

    public ParishProfileContentDto Profile { get; set; } = new();

    public PublicParishPhotoDto[] Photos { get; set; } = Array.Empty<PublicParishPhotoDto>();

    public PublicClergyDto[] Clergy { get; set; } = Array.Empty<PublicClergyDto>();

    // Site-relative address of the parish's public calendar feed (.ics).
    public string CalendarFeed { get; set; } = string.Empty;

    public DateTimeOffset? PublishedAt { get; set; } = null;
}
