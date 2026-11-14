// Purpose: one uploaded image of a priest's handwritten signature, kept in private storage for printing on paper certificates.
// It is a picture, not an electronic signature: it proves nothing about who approved a document. Versions are kept, never overwritten.
// Main members: Id, ParishId, AccountId, StoragePath, ContentType, Size, Sha256, Status (Active, Replaced or Removed), upload and removal facts.

namespace ParishLife.Api.Models;

public class ClergySignatureImage
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string AccountId { get; set; } = string.Empty;

    public string StoragePath { get; set; } = string.Empty;

    public string ContentType { get; set; } = string.Empty;

    public long Size { get; set; }

    public string Sha256 { get; set; } = string.Empty;

    public string Status { get; set; } = "Active";

    public DateTimeOffset UploadedAt { get; set; }

    public string? ReplacedById { get; set; } = null;

    public DateTimeOffset? RemovedAt { get; set; } = null;
}
