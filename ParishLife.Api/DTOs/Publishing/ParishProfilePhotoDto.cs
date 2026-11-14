// Purpose: one parish profile photograph as its editors see it, including private and removed ones.
// Main members: Id, Version, ContentType, Size, Caption, CaptionAr, Status, UploadedBy, UploadedAt, PublishedBy, PublishedAt and
// PublicUrl (only while published).

namespace ParishLife.Api.DTOs.Publishing;

public class ParishProfilePhotoDto
{
    public string Id { get; set; } = string.Empty;

    public string Version { get; set; } = string.Empty;

    public string ContentType { get; set; } = string.Empty;

    public long Size { get; set; }

    public string? Caption { get; set; } = null;

    public string? CaptionAr { get; set; } = null;

    public string Status { get; set; } = "Private";

    public string UploadedBy { get; set; } = string.Empty;

    public DateTimeOffset UploadedAt { get; set; }

    public string? PublishedBy { get; set; } = null;

    public DateTimeOffset? PublishedAt { get; set; } = null;

    public string? PublicUrl { get; set; } = null;
}
