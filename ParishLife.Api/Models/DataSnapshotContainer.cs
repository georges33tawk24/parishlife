// Purpose: one container's record file inside an operator snapshot (JSON lines, storage system properties removed).
// Main members: Name, File, Records, Partitions and Sha256 of the exact file bytes.

namespace ParishLife.Api.Models;

public class DataSnapshotContainer
{
    public string Name { get; set; } = string.Empty;

    public string File { get; set; } = string.Empty;

    public int Records { get; set; }

    public int Partitions { get; set; }

    public string Sha256 { get; set; } = string.Empty;
}
