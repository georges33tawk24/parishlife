// Purpose: proves the private operator snapshot (W07) against isolated Local storage: exact export/verify/restore round trip with
// evidence, protected fields staying ciphertext and no key ring, refusal of source/non-empty targets, tamper detection, concurrent-write
// detection, input validation, and operator-only registration. Every storage path is a verified temporary directory; no Azure is used.
// Main tests: Round_trip_restores_exact_records_and_evidence_into_empty_isolated_target, Restore_refuses_source_and_non_empty_targets,
// Verify_detects_tampering_stray_files_and_wrong_recorded_hash, Export_refuses_reuse_and_writes_during_export, Operator_registration_only.

using System.Security.Cryptography;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Hosting.Internal;
using ParishLife.Api.Configuration;
using ParishLife.Api.Data.Cosmos;
using ParishLife.Api.Data.Local;
using ParishLife.Api.DTOs.Requests;
using ParishLife.Api.Extensions;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Files;
using ParishLife.Api.Services.Operations;
using ParishLife.Api.Services.Requests;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class DataSnapshotTests
{
    private static readonly byte[] Pdf = "%PDF-1.4 isolated snapshot evidence"u8.ToArray();
    private const string FixtureSecret = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

    [Fact]
    public async Task Round_trip_restores_exact_records_and_evidence_into_empty_isolated_target()
    {
        await using var f = await SourceAsync();
        using var temp = new TempDirectory();
        var snapshot = temp.Sub("snapshot");
        var manifest = await Source(f).ExportAsync(snapshot, "CHG-isolated-1", default);

        Assert.Equal(1, manifest.FormatVersion);
        Assert.Contains(manifest.Containers, c => c.Name == Containers.Accounts && c.Records > 0);
        var item = Assert.Single(manifest.Evidence);
        Assert.Equal(Convert.ToHexString(SHA256.HashData(Pdf)), item.Sha256);
        // The source has a Development key ring; the snapshot holds only listed files, protected fields as ciphertext and no plaintext secret.
        Assert.NotEmpty(Directory.GetFiles(Path.Combine(f.DirectoryPath, "keyring")));
        var files = Directory.GetFiles(snapshot, "*", SearchOption.AllDirectories);
        Assert.DoesNotContain(files, file => file.Contains("keyring", StringComparison.OrdinalIgnoreCase) || file.EndsWith(".xml", StringComparison.Ordinal));
        var text = string.Concat(files.Where(file => !file.EndsWith(".bin", StringComparison.Ordinal)).Select(File.ReadAllText));
        Assert.Contains("dp1:", text, StringComparison.Ordinal);
        Assert.DoesNotContain(FixtureSecret, text, StringComparison.Ordinal);
        Assert.DoesNotContain("isolated-fixture-long-password", text, StringComparison.Ordinal);
        Assert.DoesNotContain("<encryptedSecret", text, StringComparison.Ordinal);
        Assert.Equal(manifest.SnapshotId, (await DataSnapshotService.VerifyAsync(snapshot, null, default)).SnapshotId);

        var targetRoot = temp.Sub("target");
        var target = Target(targetRoot);
        var dry = await target.RestoreAsync(snapshot, await DataSnapshotService.ManifestSha256Async(snapshot, default), "CHG-isolated-1 exercise", apply: false, default);
        Assert.Equal("DryRunReady", dry.Status);
        Assert.Empty(dry.Refusals);
        Assert.Equal(manifest.Containers.Sum(c => c.Records), dry.Records);
        Assert.True(dry.Batches >= manifest.Containers.Count(c => c.Records > 0));
        Assert.False(Directory.Exists(Path.Combine(targetRoot, "evidence")));
        Assert.Equal(0, await CountAsync(targetRoot));

        var report = await target.RestoreAsync(snapshot, null, "CHG-isolated-1 exercise", apply: true, default);
        Assert.Equal("Restored", report.Status);
        Assert.Equal(dry.Records, report.RecordsVerified);
        Assert.Equal(1, report.EvidenceVerified);
        Assert.Equal(Pdf, await new LocalEvidenceStore(targetRoot).OpenAsync(item.StoragePath, default));
        var audit = await new LocalDocumentDatabase(targetRoot).ReadAsync(Containers.Catalog, DataSnapshotService.AuditPartition, report.AuditId!, default);
        Assert.Contains("operations.snapshot_restore", audit!.Document.GetRawText(), StringComparison.Ordinal);
        Assert.Contains("CHG-isolated-1 exercise", audit.Document.GetRawText(), StringComparison.Ordinal);
        // The key ring never travelled: the restored target has none until its custodian supplies the matching one.
        Assert.False(Directory.Exists(Path.Combine(targetRoot, "keyring")));
    }

    [Fact]
    public async Task Restore_refuses_source_and_non_empty_targets_without_writing()
    {
        await using var f = await SourceAsync();
        using var temp = new TempDirectory();
        var snapshot = temp.Sub("snapshot");
        await Source(f).ExportAsync(snapshot, "CHG-isolated-2", default);

        var intoSource = await Source(f).RestoreAsync(snapshot, null, "CHG-isolated-2", apply: true, default);
        Assert.Equal("Refused", intoSource.Status);
        Assert.Contains(intoSource.Refusals, r => r.Contains("record store is this snapshot's source", StringComparison.Ordinal));
        Assert.Contains(intoSource.Refusals, r => r.Contains("evidence store is this snapshot's source", StringComparison.Ordinal));
        Assert.Contains(intoSource.Refusals, r => r.Contains("already holds records", StringComparison.Ordinal));

        var targetRoot = temp.Sub("target");
        Assert.Equal("Restored", (await Target(targetRoot).RestoreAsync(snapshot, null, "CHG-isolated-2", apply: true, default)).Status);
        var before = await CountAsync(targetRoot);
        var again = await Target(targetRoot).RestoreAsync(snapshot, null, "CHG-isolated-2", apply: true, default);
        Assert.Equal("Refused", again.Status);
        Assert.Contains(again.Refusals, r => r.Contains("already holds records", StringComparison.Ordinal));
        Assert.Contains(again.Refusals, r => r.Contains("evidence paths", StringComparison.Ordinal));
        Assert.Null(again.AuditId);
        Assert.Equal(before, await CountAsync(targetRoot));

        // Evidence alone in a target is also non-empty: nothing is merged.
        var evidenceOnly = temp.Sub("evidence-only");
        var path = (await DataSnapshotService.VerifyAsync(snapshot, null, default)).Evidence[0].StoragePath;
        await new LocalEvidenceStore(evidenceOnly).PutAsync(path, Pdf, "application/pdf", default);
        Assert.Equal("Refused", (await Target(evidenceOnly).RestoreAsync(snapshot, null, "CHG-isolated-2", apply: true, default)).Status);
        Assert.Equal(1, await CountAsync(evidenceOnly)); // only the pre-existing evidence object; no records were written

        // A target that cannot create containers needs them initialized first.
        var cosmosLike = new DataSnapshotService(new LocalDocumentDatabase(temp.Sub("no-containers")), new LocalEvidenceStore(temp.Sub("no-containers")),
            "Cosmos:isolated", "Blob:isolated", createsContainers: false, TimeProvider.System);
        var missing = await cosmosLike.RestoreAsync(snapshot, null, "CHG-isolated-2", apply: true, default);
        Assert.Equal("Refused", missing.Status);
        Assert.Contains(Containers.Accounts, missing.MissingContainers);
    }

    [Fact]
    public async Task Verify_detects_tampering_stray_files_and_wrong_recorded_hash()
    {
        await using var f = await SourceAsync();
        using var temp = new TempDirectory();
        var snapshot = temp.Sub("snapshot");
        await Source(f).ExportAsync(snapshot, "CHG-isolated-3", default);
        var hash = await DataSnapshotService.ManifestSha256Async(snapshot, default);

        Assert.Equal("snapshot_invalid", (await Assert.ThrowsAsync<DomainException>(() => DataSnapshotService.VerifyAsync(snapshot, new string('0', 64), default))).Code);
        var stray = Path.Combine(snapshot, "keyring.xml");
        await File.WriteAllTextAsync(stray, "<key/>");
        Assert.Equal("snapshot_invalid", (await Assert.ThrowsAsync<DomainException>(() => DataSnapshotService.VerifyAsync(snapshot, hash, default))).Code);
        File.Delete(stray);
        await DataSnapshotService.VerifyAsync(snapshot, hash, default);

        var records = Path.Combine(snapshot, "records", Containers.Accounts + ".jsonl");
        var original = await File.ReadAllBytesAsync(records);
        await File.WriteAllBytesAsync(records, [.. original, .. "{\"id\":\"x\",\"partitionKey\":\"y\"}\n"u8.ToArray()]);
        Assert.Equal("snapshot_invalid", (await Assert.ThrowsAsync<DomainException>(() => DataSnapshotService.VerifyAsync(snapshot, hash, default))).Code);
        var restore = await Assert.ThrowsAsync<DomainException>(() => Target(temp.Sub("target")).RestoreAsync(snapshot, null, "CHG-isolated-3", apply: true, default));
        Assert.Equal("snapshot_invalid", restore.Code);
        Assert.Equal(0, await CountAsync(temp.Sub("target")));
        await File.WriteAllBytesAsync(records, original);

        var manifestPath = Path.Combine(snapshot, DataSnapshotService.ManifestFile);
        await File.WriteAllTextAsync(manifestPath, (await File.ReadAllTextAsync(manifestPath)).Replace("CHG-isolated-3", "CHG-isolated-X", StringComparison.Ordinal));
        Assert.Equal("snapshot_invalid", (await Assert.ThrowsAsync<DomainException>(() => DataSnapshotService.VerifyAsync(snapshot, null, default))).Code);
    }

    [Fact]
    public async Task Export_refuses_reuse_blank_reference_and_writes_during_export()
    {
        await using var f = await SourceAsync();
        using var temp = new TempDirectory();
        var snapshot = temp.Sub("snapshot");
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => Source(f).ExportAsync(snapshot, "  ", default))).Code);
        Assert.False(Directory.Exists(snapshot));
        await Source(f).ExportAsync(snapshot, "CHG-isolated-4", default);
        Assert.Equal("snapshot_directory_not_empty", (await Assert.ThrowsAsync<DomainException>(() => Source(f).ExportAsync(snapshot, "CHG-isolated-4", default))).Code);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => Target(temp.Sub("target")).RestoreAsync(snapshot, null, "", apply: false, default))).Code);

        var changing = new WriteDuringExport(f.Services.GetRequiredService<IDocumentDatabase>());
        var service = new DataSnapshotService(changing, f.Services.GetRequiredService<IEvidenceStore>(), "Local:changing", "Local:changing-evidence", true, f.Clock);
        var busy = temp.Sub("busy");
        Assert.Equal("snapshot_source_changed", (await Assert.ThrowsAsync<DomainException>(() => service.ExportAsync(busy, "CHG-isolated-4", default))).Code);
        Assert.False(File.Exists(Path.Combine(busy, DataSnapshotService.ManifestFile)));
        Assert.Equal("snapshot_invalid", (await Assert.ThrowsAsync<DomainException>(() => DataSnapshotService.VerifyAsync(busy, null, default))).Code);
    }

    [Fact]
    public async Task Snapshot_service_is_registered_only_for_the_operator_tool_with_the_isolated_identity()
    {
        using var temp = new TempDirectory();
        var root = temp.Sub("operator");
        ServiceProvider Build(bool operatorWorkstation)
        {
            var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Storage:Provider"] = "Local",
                ["Storage:LocalPath"] = root
            }).Build();
            var environment = new HostingEnvironment { EnvironmentName = Environments.Development, ApplicationName = "ParishLife.Api", ContentRootPath = root };
            var services = new ServiceCollection();
            services.AddLogging();
            services.AddSingleton<IConfiguration>(configuration);
            services.AddSingleton<IHostEnvironment>(environment);
            services.AddParishLifeBackend(configuration, environment, operatorWorkstation);
            return services.BuildServiceProvider();
        }

        await using (var web = Build(false))
            Assert.Null(web.CreateScope().ServiceProvider.GetService<DataSnapshotService>());
        await using var tool = Build(true);
        using var scope = tool.CreateScope();
        var manifest = await scope.ServiceProvider.GetRequiredService<DataSnapshotService>().ExportAsync(temp.Sub("snapshot"), "CHG-isolated-5", default);
        Assert.Equal("Local:" + Path.Combine(root, "documents"), manifest.SourceDocuments);
        Assert.Equal("Local:" + Path.Combine(root, "evidence"), manifest.SourceEvidence);
        Assert.Empty(manifest.Evidence);
    }

    // Isolated source: the two bootstrap administrators (MFA secrets protected at rest) plus one real request evidence upload.
    private static async Task<LocalBackendFixture> SourceAsync()
    {
        var f = new LocalBackendFixture();
        Assert.StartsWith(Path.GetFullPath(Path.GetTempPath()), Path.GetFullPath(f.DirectoryPath), StringComparison.Ordinal);
        await f.InitializeAsync();
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        await staff.ActivateOfficeAsync(["core", "office", "requests"]);
        var applicant = await f.CreateVerifiedMemberAsync();
        f.As(applicant, false);
        var request = await f.Services.GetRequiredService<RequestService>().SubmitAsync(staff.Parish, new SubmitRequestDto
        { OperationId = Guid.NewGuid(), Kind = "General", Summary = "Isolated snapshot case" }, default);
        await f.Services.GetRequiredService<EvidenceService>().UploadAsync(staff.Parish, request.Id, Guid.NewGuid(), "proof.pdf", "application/pdf", Pdf, null, null, default);
        return f;
    }

    private static DataSnapshotService Source(LocalBackendFixture f) => new(f.Services.GetRequiredService<IDocumentDatabase>(), f.Services.GetRequiredService<IEvidenceStore>(),
        "Local:" + Path.Combine(f.DirectoryPath, "documents"), "Local:" + Path.Combine(f.DirectoryPath, "evidence"), true, f.Clock);

    private static DataSnapshotService Target(string root) => new(new LocalDocumentDatabase(root), new LocalEvidenceStore(root),
        "Local:" + Path.Combine(root, "documents"), "Local:" + Path.Combine(root, "evidence"), true, TimeProvider.System);

    private static async Task<int> CountAsync(string root)
    {
        var database = new LocalDocumentDatabase(root);
        var count = 0;
        foreach (var container in await database.ContainersAsync(default))
            count += (await database.QueryAsync(container, null, StorageQuery.All, 1000, null, default)).Items.Count;
        return count + (Directory.Exists(Path.Combine(root, "evidence")) ? Directory.GetFiles(Path.Combine(root, "evidence"), "*", SearchOption.AllDirectories).Count(p => !p.EndsWith(".lock", StringComparison.Ordinal)) : 0);
    }

    // Commits one new record just before the export's second pass, as a concurrent API write would.
    private sealed class WriteDuringExport(IDocumentDatabase inner) : IDocumentDatabase
    {
        private int calls;
        public Task<StoredRow?> ReadAsync(string container, string key, string id, CancellationToken ct) => inner.ReadAsync(container, key, id, ct);
        public Task<StoredPage> QueryAsync(string container, string? key, StorageQuery query, int size, string? continuation, CancellationToken ct) => inner.QueryAsync(container, key, query, size, continuation, ct);
        public Task<IReadOnlyList<string>> CommitAsync(string container, string key, IReadOnlyList<DocumentMutation> mutations, CancellationToken ct) => inner.CommitAsync(container, key, mutations, ct);
        public async Task<IReadOnlyList<string>> ContainersAsync(CancellationToken ct)
        {
            if (++calls == 2)
            {
                var row = JsonDefaults.Row("isolated-concurrent", "platform:isolated", "isolated", new { Note = "concurrent write" });
                await inner.CommitAsync(Containers.Catalog, "platform:isolated", [new DocumentMutation("create", row.Id, System.Text.Json.JsonSerializer.SerializeToElement(row, JsonDefaults.Options), null)], ct);
            }
            return await inner.ContainersAsync(ct);
        }
    }

    private sealed class TempDirectory : IDisposable
    {
        private readonly string root = Path.Combine(Path.GetTempPath(), "ParishLife-Snapshot-" + Guid.NewGuid().ToString("N"));

        public string Sub(string name)
        {
            var path = Path.Combine(root, name);
            Assert.StartsWith(Path.GetFullPath(Path.GetTempPath()), Path.GetFullPath(path), StringComparison.Ordinal);
            return path;
        }

        public void Dispose()
        {
            if (Path.GetFullPath(root).StartsWith(Path.GetFullPath(Path.GetTempPath()), StringComparison.Ordinal) && Directory.Exists(root))
                Directory.Delete(root, recursive: true);
        }
    }
}
