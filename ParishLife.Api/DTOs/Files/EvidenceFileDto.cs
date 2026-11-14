// Purpose: shows evidence file metadata to those allowed to see the file.
// Main members: Id, Version, FileName, ContentType, Size, Sha256, UploaderRole, UploadedAt, Status, ReplacesId, ReplacedById, Reason and ChecklistKey.

namespace ParishLife.Api.DTOs.Files;

public class EvidenceFileDto
{
    public string Id { get; set; } = string.Empty;

    public string Version { get; set; } = string.Empty;

    public string FileName { get; set; } = string.Empty;

    public string ContentType { get; set; } = string.Empty;

    public long Size { get; set; }

    public string Sha256 { get; set; } = string.Empty;

    public string UploaderRole { get; set; } = string.Empty;

    public DateTimeOffset UploadedAt { get; set; }

    public string Status { get; set; } = string.Empty;

    public string? ReplacesId { get; set; }

    public string? ReplacedById { get; set; }

    public string? Reason { get; set; }

    // The checklist item this file answers, when the uploader named one; the office still decides whether the item is received.
    public string? ChecklistKey { get; set; }
}
