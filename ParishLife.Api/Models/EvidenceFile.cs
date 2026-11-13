// Purpose: metadata for one private evidence file attached to a request case; content lives write-once in the evidence store.
// Main members: Id, ParishId, RequestId, FileName, ContentType, Size, Sha256, StoragePath, UploadedBy, UploaderRole, UploadedAt,
// Status, ReplacesId, ReplacedById, Reason and ChecklistKey.

namespace ParishLife.Api.Models;

public class EvidenceFile
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string RequestId { get; set; } = string.Empty;

    // The name as supplied, including Arabic or French characters; never used in the storage path.
    public string FileName { get; set; } = string.Empty;

    public string ContentType { get; set; } = string.Empty;

    public long Size { get; set; }

    public string Sha256 { get; set; } = string.Empty;

    public string StoragePath { get; set; } = string.Empty;

    public string UploadedBy { get; set; } = string.Empty;

    // Applicant, Office or Guest (a tracking-token upload, UploadedBy "guest:{request}").
    public string UploaderRole { get; set; } = string.Empty;

    public DateTimeOffset UploadedAt { get; set; }

    // Active, Replaced or Removed; content is kept for the retention rules either way.
    public string Status { get; set; } = "Active";

    public string? ReplacesId { get; set; }

    public string? ReplacedById { get; set; }

    public string? Reason { get; set; }

    // The checklist item this file answers, when the uploader named one; the office still decides whether the item is received.
    public string? ChecklistKey { get; set; }
}
