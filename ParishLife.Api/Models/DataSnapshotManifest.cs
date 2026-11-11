// Purpose: describes one private operator backup snapshot: format/version, source identity, operator reference, consistency result,
// what was deliberately excluded, and the per-container record files and evidence files with their counts and SHA-256 hashes.
// Main members: Format, FormatVersion, SnapshotId, CreatedAt, OperatorReference, SourceDocuments, SourceEvidence, Label, Consistency,
// Exclusions, Containers and Evidence.

namespace ParishLife.Api.Models;

public class DataSnapshotManifest
{
    public const string ExpectedFormat = "ParishLife.OperatorSnapshot";

    public string Format { get; set; } = ExpectedFormat;

    public int FormatVersion { get; set; } = 1;

    public string SnapshotId { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    // The operator's change/approval reference; never a credential.
    public string OperatorReference { get; set; } = string.Empty;

    // Non-secret provider/endpoint/database (or local path) identities; restore refuses either one as its target.
    public string SourceDocuments { get; set; } = string.Empty;

    public string SourceEvidence { get; set; } = string.Empty;

    public string Label { get; set; } = string.Empty;

    public string Consistency { get; set; } = string.Empty;

    public List<string> Exclusions { get; set; } = [];

    public List<DataSnapshotContainer> Containers { get; set; } = [];

    public List<DataSnapshotEvidence> Evidence { get; set; } = [];
}
