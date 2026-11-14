// Purpose: one published parish photograph for visitors: a site-relative address and the captions, nothing about who uploaded it.
// Main members: Id, Url, Caption and CaptionAr.

namespace ParishLife.Api.DTOs.Publishing;

public class PublicParishPhotoDto
{
    public string Id { get; set; } = string.Empty;

    public string Url { get; set; } = string.Empty;

    public string? Caption { get; set; } = null;

    public string? CaptionAr { get; set; } = null;
}
