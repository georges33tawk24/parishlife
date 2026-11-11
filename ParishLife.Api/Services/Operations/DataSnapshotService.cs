// Purpose: private operator backup snapshots (W07). Exports every existing record container plus the evidence objects that records
// reference into a versioned directory with a hashed manifest; verifies a snapshot offline; restores one only into an EMPTY isolated
// target that is not the snapshot's source, with a dry-run report, read-back verification and a restore audit row in the target.
// Records are copied exactly as stored, so Data Protection-protected fields stay ciphertext; the key ring and secrets are never read.
// Main functions: ExportAsync, VerifyAsync, RestoreAsync; LoadAsync, AllAsync, Strip, Reference, Batches and Same are helpers.

using System.Runtime.CompilerServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using ParishLife.Api.Configuration;
using ParishLife.Api.Data.Cosmos;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Operations;

public sealed class DataSnapshotService
{
    internal const string ManifestFile = "manifest.json";
    internal const string ManifestHashFile = "manifest.sha256";
    internal const string AuditPartition = "platform:operations";
    private const int PageSize = 100;
    private const int BatchItems = 100;
    private const int BatchBytes = 1_500_000;
    private const string Label = "Operator backup snapshot - not a browser Data snapshot / Review export. Protected fields remain encrypted and "
        + "are readable only with the matching Data Protection key ring, which is held separately. Records and evidence files are personal data: store privately.";
    private static readonly string[] Exclusions =
    [
        "Data Protection key ring (never read; held separately by its custodian)",
        "Key Vault keys, credentials, connection strings and application settings",
        "Storage system properties (_rid, _self, _etag, _attachments, _ts)",
        "Evidence objects that no record references (abandoned staged uploads)"
    ];
    private static readonly Regex ContainerName = new(@"\A[A-Za-z][A-Za-z0-9_-]{0,63}\z");
    private static readonly Regex EvidenceFile = new(@"\Aevidence/[0-9]{6}\.bin\z");
    private static readonly JsonSerializerOptions Indented = new(JsonDefaults.Options) { WriteIndented = true };

    private readonly IDocumentDatabase documents;
    private readonly IEvidenceStore evidence;
    private readonly string documentsIdentity;
    private readonly string evidenceIdentity;
    private readonly bool createsContainers;
    private readonly TimeProvider clock;

    // The identities are non-secret descriptions of the configured stores (provider plus endpoint/database or local path).
    internal DataSnapshotService(IDocumentDatabase documents, IEvidenceStore evidence, string documentsIdentity, string evidenceIdentity,
        bool createsContainers, TimeProvider clock)
    {
        this.documents = documents;
        this.evidence = evidence;
        this.documentsIdentity = documentsIdentity;
        this.evidenceIdentity = evidenceIdentity;
        this.createsContainers = createsContainers;
        this.clock = clock;
    }

    private sealed record Loaded(DataSnapshotManifest Manifest, string Sha256, Dictionary<string, List<JsonObject>> Records);

    private static DomainException Invalid(string message) => new("snapshot_invalid", message, FailureKind.Conflict);

    public async Task<DataSnapshotManifest> ExportAsync(string directory, string operatorReference, CancellationToken ct)
    {
        var reference = Guard.Text(operatorReference, "Operator reference", 500);
        var root = Path.GetFullPath(directory);
        if (Directory.Exists(root) && Directory.EnumerateFileSystemEntries(root).Any())
            throw new DomainException("snapshot_directory_not_empty", "Choose a new or empty snapshot directory; an existing snapshot is never overwritten.", FailureKind.Conflict);
        Directory.CreateDirectory(Path.Combine(root, "records"));
        Directory.CreateDirectory(Path.Combine(root, "evidence"));
        var manifest = new DataSnapshotManifest
        {
            SnapshotId = Guid.NewGuid().ToString("N"),
            CreatedAt = clock.GetUtcNow(),
            OperatorReference = reference,
            SourceDocuments = documentsIdentity,
            SourceEvidence = evidenceIdentity,
            Label = Label,
            Exclusions = [.. Exclusions]
        };
        // ponytail: version fingerprints and evidence references are held in memory; stream to disk if datasets outgrow operator RAM.
        var first = new HashSet<string>(StringComparer.Ordinal);
        var references = new SortedDictionary<string, string>(StringComparer.Ordinal);
        foreach (var container in await documents.ContainersAsync(ct))
        {
            if (!ContainerName.IsMatch(container))
                throw Invalid("A container name cannot be represented safely in a snapshot.");
            var file = "records/" + container + ".jsonl";
            var partitions = new HashSet<string>(StringComparer.Ordinal);
            var count = 0;
            await using (var stream = new FileStream(Path.Combine(root, file), FileMode.CreateNew, FileAccess.Write, FileShare.None))
            {
                await foreach (var row in AllAsync(container, ct))
                {
                    var (key, id, node) = Strip(row.Document);
                    first.Add(container + "\0" + key + "\0" + id + "\0" + row.Version);
                    partitions.Add(key);
                    Reference(node, references);
                    await stream.WriteAsync(Encoding.UTF8.GetBytes(node.ToJsonString() + "\n"), ct);
                    count++;
                }
                await stream.FlushAsync(ct);
                stream.Flush(flushToDisk: true);
            }
            manifest.Containers.Add(new DataSnapshotContainer
            {
                Name = container,
                File = file,
                Records = count,
                Partitions = partitions.Count,
                Sha256 = Hash(await File.ReadAllBytesAsync(Path.Combine(root, file), ct))
            });
        }

        foreach (var (path, type) in references)
        {
            var content = await evidence.OpenAsync(path, ct)
                ?? throw new DomainException("snapshot_evidence_missing", "A record references evidence the store does not hold; investigate before relying on any snapshot.", FailureKind.Unavailable);
            var file = $"evidence/{manifest.Evidence.Count + 1:D6}.bin";
            await File.WriteAllBytesAsync(Path.Combine(root, file), content, ct);
            manifest.Evidence.Add(new DataSnapshotEvidence { StoragePath = path, File = file, ContentType = type, Bytes = content.Length, Sha256 = Hash(content) });
        }

        // Consistency: a second complete pass must see exactly the same items and versions; otherwise writes ran during the export.
        var second = new HashSet<string>(StringComparer.Ordinal);
        foreach (var container in await documents.ContainersAsync(ct))
            await foreach (var row in AllAsync(container, ct))
            {
                var (key, id, _) = Strip(row.Document);
                second.Add(container + "\0" + key + "\0" + id + "\0" + row.Version);
            }
        if (!first.SetEquals(second))
            throw new DomainException("snapshot_source_changed", "Records changed while the snapshot was taken. Stop writes (maintenance window) and export again into a new directory; this directory has no manifest and is not a snapshot.", FailureKind.Conflict);
        manifest.Consistency = "No record was added, removed or changed between two complete passes; writes must still be stopped for a point-in-time copy.";

        var bytes = JsonSerializer.SerializeToUtf8Bytes(manifest, Indented);
        await File.WriteAllBytesAsync(Path.Combine(root, ManifestFile), bytes, ct);
        await File.WriteAllTextAsync(Path.Combine(root, ManifestHashFile), Hash(bytes) + "\n", ct);
        return manifest;
    }

    // Offline integrity check: manifest hash (and the operator's recorded hash when supplied), exact file set, per-file hashes and counts.
    public static async Task<DataSnapshotManifest> VerifyAsync(string directory, string? expectedManifestSha256, CancellationToken ct)
        => (await LoadAsync(directory, expectedManifestSha256, ct)).Manifest;

    public static async Task<string> ManifestSha256Async(string directory, CancellationToken ct)
        => (await LoadAsync(directory, null, ct)).Sha256;

    public async Task<DataSnapshotRestoreReport> RestoreAsync(string directory, string? expectedManifestSha256, string operatorReference, bool apply, CancellationToken ct)
    {
        var reference = Guard.Text(operatorReference, "Operator reference", 500);
        var snapshot = await LoadAsync(directory, expectedManifestSha256, ct);
        var manifest = snapshot.Manifest;
        var report = new DataSnapshotRestoreReport
        {
            SnapshotId = manifest.SnapshotId,
            ManifestSha256 = snapshot.Sha256,
            TargetDocuments = documentsIdentity,
            TargetEvidence = evidenceIdentity
        };
        if (Same(documentsIdentity, manifest.SourceDocuments))
            report.Refusals.Add("The target record store is this snapshot's source; restore only into a separate isolated target.");
        if (Same(evidenceIdentity, manifest.SourceEvidence))
            report.Refusals.Add("The target evidence store is this snapshot's source; restore only into a separate isolated target.");
        var existing = await documents.ContainersAsync(ct);
        foreach (var container in existing)
            if ((await documents.QueryAsync(container, null, StorageQuery.All, 1, null, ct)).Items.Count > 0)
                report.Refusals.Add($"Target container {container} already holds records; restore never merges into or overwrites existing data.");
        report.MissingContainers = manifest.Containers.Select(c => c.Name).Where(name => !existing.Contains(name, StringComparer.Ordinal)).ToList();
        if (!createsContainers && report.MissingContainers.Count > 0)
            report.Refusals.Add("The target lacks snapshot containers; create them with the reviewed initialization procedure before restoring.");
        foreach (var item in manifest.Evidence)
            if (await evidence.OpenAsync(item.StoragePath, ct) is not null)
            {
                report.Refusals.Add("The target evidence store already holds snapshot evidence paths; use an empty evidence location.");
                break;
            }

        var plan = manifest.Containers.Select(c => (c.Name, Batches: Batches(snapshot.Records[c.Name]).ToList())).ToList();
        report.Records = manifest.Containers.Sum(c => c.Records);
        report.Partitions = manifest.Containers.Sum(c => c.Partitions);
        report.Batches = plan.Sum(p => p.Batches.Count);
        report.EvidenceFiles = manifest.Evidence.Count;
        report.EvidenceBytes = manifest.Evidence.Sum(e => e.Bytes);
        report.CompletedAt = clock.GetUtcNow();
        if (report.Refusals.Count > 0)
            return report;
        if (!apply)
        {
            report.Status = "DryRunReady";
            return report;
        }

        // Create-only writes: an item that appeared since the emptiness check is a write_conflict, never an overwrite.
        foreach (var (container, batches) in plan)
            foreach (var (key, items) in batches)
                await documents.CommitAsync(container, key, items.Select(item => new DocumentMutation("create", Text(item["id"])!, JsonSerializer.SerializeToElement(item), null)).ToList(), ct);
        var root = Path.GetFullPath(directory);
        foreach (var item in manifest.Evidence)
        {
            var content = await File.ReadAllBytesAsync(Path.Combine(root, item.File), ct);
            if (Hash(content) != item.Sha256)
                throw Invalid("An evidence file changed after verification; nothing further was restored.");
            await evidence.PutAsync(item.StoragePath, content, item.ContentType, ct);
        }

        foreach (var container in manifest.Containers)
            foreach (var item in snapshot.Records[container.Name])
            {
                var row = await documents.ReadAsync(container.Name, Text(item["partitionKey"])!, Text(item["id"])!, ct);
                if (row is null || !JsonNode.DeepEquals(item, Strip(row.Document).Node))
                    throw new DomainException("restore_verification_failed", "A restored record does not read back exactly; treat this target as failed and discard it.", FailureKind.Unavailable);
                report.RecordsVerified++;
            }
        foreach (var item in manifest.Evidence)
        {
            var content = await evidence.OpenAsync(item.StoragePath, ct);
            if (content is null || Hash(content) != item.Sha256)
                throw new DomainException("restore_verification_failed", "Restored evidence does not read back exactly; treat this target as failed and discard it.", FailureKind.Unavailable);
            report.EvidenceVerified++;
        }

        var at = clock.GetUtcNow();
        var auditId = "audit:snapshot-restore:" + Guid.NewGuid().ToString("N");
        var audit = JsonDefaults.Row(auditId, AuditPartition, "audit", new AuditEntry("operator", "operations.snapshot_restore", manifest.SnapshotId, auditId, at, reference));
        await documents.CommitAsync(Containers.Catalog, AuditPartition, [new DocumentMutation("create", auditId, JsonSerializer.SerializeToElement(audit, JsonDefaults.Options), null)], ct);
        report.AuditId = auditId;
        report.Status = "Restored";
        report.CompletedAt = at;
        return report;
    }

    private static async Task<Loaded> LoadAsync(string directory, string? expectedManifestSha256, CancellationToken ct)
    {
        var root = Path.GetFullPath(directory);
        var manifestPath = Path.Combine(root, ManifestFile);
        var hashPath = Path.Combine(root, ManifestHashFile);
        if (!File.Exists(manifestPath) || !File.Exists(hashPath))
            throw Invalid("The directory has no complete snapshot manifest.");
        var bytes = await File.ReadAllBytesAsync(manifestPath, ct);
        var sha = Hash(bytes);
        if (!string.Equals((await File.ReadAllTextAsync(hashPath, ct)).Trim(), sha, StringComparison.OrdinalIgnoreCase)
            || expectedManifestSha256 is not null && !string.Equals(expectedManifestSha256.Trim(), sha, StringComparison.OrdinalIgnoreCase))
            throw Invalid("The manifest hash does not match.");
        DataSnapshotManifest manifest;
        try { manifest = JsonSerializer.Deserialize<DataSnapshotManifest>(bytes, JsonDefaults.Options) ?? throw Invalid("The manifest is empty."); }
        catch (JsonException) { throw Invalid("The manifest is unreadable."); }
        if (manifest.Format != DataSnapshotManifest.ExpectedFormat || manifest.FormatVersion != 1)
            throw new DomainException("snapshot_unsupported", "This snapshot format or version is not supported by this tool.", FailureKind.Conflict);

        var allowed = new HashSet<string>(StringComparer.Ordinal) { ManifestFile, ManifestHashFile };
        foreach (var container in manifest.Containers)
            if (!ContainerName.IsMatch(container.Name) || container.File != "records/" + container.Name + ".jsonl" || !allowed.Add(container.File))
                throw Invalid("The manifest lists an invalid or duplicate container.");
        var paths = new HashSet<string>(StringComparer.Ordinal);
        foreach (var item in manifest.Evidence)
            if (!EvidenceFile.IsMatch(item.File) || !allowed.Add(item.File) || !ValidStoragePath(item.StoragePath) || !paths.Add(item.StoragePath)
                || string.IsNullOrWhiteSpace(item.ContentType))
                throw Invalid("The manifest lists invalid or duplicate evidence.");
        // Only the listed files may exist, so nothing else (a key ring, settings, logs) can travel inside a snapshot.
        foreach (var file in Directory.EnumerateFiles(root, "*", SearchOption.AllDirectories))
            if (!allowed.Contains(Path.GetRelativePath(root, file).Replace(Path.DirectorySeparatorChar, '/')))
                throw Invalid("The snapshot directory contains a file the manifest does not list.");

        var records = new Dictionary<string, List<JsonObject>>(StringComparer.Ordinal);
        foreach (var container in manifest.Containers)
        {
            var path = Path.Combine(root, container.File);
            if (!File.Exists(path))
                throw Invalid("A listed record file is missing.");
            var content = await File.ReadAllBytesAsync(path, ct);
            if (Hash(content) != container.Sha256)
                throw Invalid($"Record file {container.File} does not match its hash.");
            var items = new List<JsonObject>();
            var ids = new HashSet<string>(StringComparer.Ordinal);
            var partitions = new HashSet<string>(StringComparer.Ordinal);
            foreach (var line in Encoding.UTF8.GetString(content).Split('\n', StringSplitOptions.RemoveEmptyEntries))
            {
                JsonObject node;
                try { node = JsonNode.Parse(line) as JsonObject ?? throw Invalid("A record line is not a JSON object."); }
                catch (JsonException) { throw Invalid("A record line is unreadable."); }
                var (key, id) = (Text(node["partitionKey"]), Text(node["id"]));
                if (key is null || id is null || node.Any(p => p.Key.StartsWith('_')) || !ids.Add(key + "\0" + id))
                    throw Invalid("A record line lacks its identity, carries storage properties or is duplicated.");
                partitions.Add(key);
                items.Add(node);
            }
            if (items.Count != container.Records || partitions.Count != container.Partitions)
                throw Invalid($"Record file {container.File} does not match its counts.");
            records[container.Name] = items;
        }
        foreach (var item in manifest.Evidence)
        {
            var path = Path.Combine(root, item.File);
            if (!File.Exists(path))
                throw Invalid("A listed evidence file is missing.");
            var content = await File.ReadAllBytesAsync(path, ct);
            if (content.Length != item.Bytes || Hash(content) != item.Sha256)
                throw Invalid($"Evidence file {item.File} does not match its size or hash.");
        }
        return new Loaded(manifest, sha, records);
    }

    private async IAsyncEnumerable<StoredRow> AllAsync(string container, [EnumeratorCancellation] CancellationToken ct)
    {
        string? continuation = null;
        do
        {
            var page = await documents.QueryAsync(container, null, StorageQuery.All, PageSize, continuation, ct);
            foreach (var row in page.Items)
                yield return row;
            continuation = page.Continuation;
        }
        while (continuation is not null);
    }

    // Removes storage system properties (underscore-prefixed) and returns the item's partition key and id.
    private static (string Key, string Id, JsonObject Node) Strip(JsonElement document)
    {
        if (JsonNode.Parse(document.GetRawText()) is not JsonObject node)
            throw Invalid("A stored item is not a JSON object.");
        foreach (var name in node.Select(p => p.Key).Where(k => k.StartsWith('_')).ToArray())
            node.Remove(name);
        var key = Text(node["partitionKey"]) ?? throw Invalid("A stored item has no partition key.");
        var id = Text(node["id"]) ?? throw Invalid("A stored item has no id.");
        return (key, id, node);
    }

    // Any record whose data names an evidence storage path and content type brings that write-once object into the snapshot.
    private static void Reference(JsonObject node, SortedDictionary<string, string> references)
    {
        if (node["data"] is JsonObject data && Text(data["storagePath"]) is { } path && Text(data["contentType"]) is { } type)
        {
            if (!ValidStoragePath(path))
                throw Invalid("A record references an evidence path that cannot be copied safely.");
            references.TryAdd(path, type);
        }
    }

    private static IEnumerable<(string Key, List<JsonObject> Items)> Batches(IEnumerable<JsonObject> records)
    {
        foreach (var partition in records.GroupBy(r => Text(r["partitionKey"])!, StringComparer.Ordinal))
        {
            var batch = new List<JsonObject>();
            var size = 0;
            foreach (var item in partition)
            {
                var bytes = Encoding.UTF8.GetByteCount(item.ToJsonString());
                if (batch.Count > 0 && (batch.Count == BatchItems || size + bytes > BatchBytes))
                {
                    yield return (partition.Key, batch);
                    batch = [];
                    size = 0;
                }
                batch.Add(item);
                size += bytes;
            }
            yield return (partition.Key, batch);
        }
    }

    private static bool ValidStoragePath(string path) => path.Length is > 0 and <= 400 && !path.StartsWith('/') && !path.Contains('\\')
        && path.Split('/').All(part => part.Length > 0 && part != "." && part != "..");

    private static string? Text(JsonNode? node) => node is JsonValue value && value.TryGetValue<string>(out var text) && text.Length > 0 ? text : null;

    private static bool Same(string a, string b) => string.Equals(a.TrimEnd('/', '\\'), b.TrimEnd('/', '\\'), StringComparison.OrdinalIgnoreCase);

    private static string Hash(byte[] content) => Convert.ToHexString(SHA256.HashData(content));
}
