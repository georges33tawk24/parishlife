// Purpose: the dry-run or applied result of restoring an operator snapshot into an isolated target, used as restore-exercise evidence.
// Main members: SnapshotId, ManifestSha256, TargetDocuments, TargetEvidence, Status, Refusals, MissingContainers, Records, Partitions,
// Batches, EvidenceFiles, EvidenceBytes, RecordsVerified, EvidenceVerified, AuditId and CompletedAt.

namespace ParishLife.Api.Models;

public class DataSnapshotRestoreReport
{
    public string SnapshotId { get; set; } = string.Empty;

    public string ManifestSha256 { get; set; } = string.Empty;

    public string TargetDocuments { get; set; } = string.Empty;

    public string TargetEvidence { get; set; } = string.Empty;

    // Refused (nothing written), DryRunReady (nothing written) or Restored (written and read back).
    public string Status { get; set; } = "Refused";

    public List<string> Refusals { get; set; } = [];

    public List<string> MissingContainers { get; set; } = [];

    public int Records { get; set; }

    public int Partitions { get; set; }

    public int Batches { get; set; }

    public int EvidenceFiles { get; set; }

    public long EvidenceBytes { get; set; }

    public int RecordsVerified { get; set; }

    public int EvidenceVerified { get; set; }

    public string? AuditId { get; set; }

    public DateTimeOffset CompletedAt { get; set; }
}
