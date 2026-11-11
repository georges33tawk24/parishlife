// Purpose: one write-once evidence object copied into an operator snapshot because a record references its storage path.
// Main members: StoragePath, File, ContentType, Bytes and Sha256 of the exact content.

namespace ParishLife.Api.Models;

public class DataSnapshotEvidence
{
    public string StoragePath { get; set; } = string.Empty;

    public string File { get; set; } = string.Empty;

    public string ContentType { get; set; } = string.Empty;

    public long Bytes { get; set; }

    public string Sha256 { get; set; } = string.Empty;
}
