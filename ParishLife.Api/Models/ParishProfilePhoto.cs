// Purpose: one photograph a parish uploaded for its public profile. The bytes live write-once in the private evidence store; the photo is
// Private until an editor explicitly publishes it, and only Published photos are served to visitors. Removed photos keep their bytes.
// Main members: Id, ParishId, ContentType, Size, Sha256, StoragePath, Caption, CaptionAr, Status (Private, Published, Removed),
// UploadedBy, UploadedAt, PublishedBy, PublishedAt, RemovedBy and RemovedAt.

namespace ParishLife.Api.Models;

public class ParishProfilePhoto
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string ContentType { get; set; } = string.Empty;

    public long Size { get; set; }

    public string Sha256 { get; set; } = string.Empty;

    public string StoragePath { get; set; } = string.Empty;

    public string? Caption { get; set; } = null;

    public string? CaptionAr { get; set; } = null;

    // Private, Published or Removed.
    public string Status { get; set; } = "Private";

    public string UploadedBy { get; set; } = string.Empty;

    public DateTimeOffset UploadedAt { get; set; }

    public string? PublishedBy { get; set; } = null;

    public DateTimeOffset? PublishedAt { get; set; } = null;

    public string? RemovedBy { get; set; } = null;

    public DateTimeOffset? RemovedAt { get; set; } = null;
}
